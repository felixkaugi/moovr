const Ride = require("../models/Ride");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const stripe = require("../utils/stripe");
const paystack = require("../utils/paystack");
const { getIo } = require("../socket"); // Import the getIo function
const { calculateFare } = require("../utils/rateCalculator");
const { notifyUser } = require("../utils/notificationService");
const Review = require("../models/Review");

// Get Nearby Drivers
exports.getNearbyDrivers = async (req, res) => {
  const { lng, lat, radius = 5000 } = req.query; // radius in meters, default 5km

  if (!lng || !lat) {
    return res.status(400).json({ message: "Longitude and latitude are required" });
  }

  try {
    const drivers = await User.find({
      role: "driver",
      availability: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(radius),
        },
      },
    }).select("firstName lastName profilePicture carCategory serviceType ratingAverage availability location");

    res.status(200).json(drivers);
  } catch (error) {
    console.error("Error fetching nearby drivers:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Create Ride
exports.createRide = async (req, res) => {
  const {
    pickupLocation,
    dropoffLocation,
    pickupCoordinates,
    dropoffCoordinates,
    distance,
    estimatedTime,
    vehicleType,
    pickupType,
    scheduleTime,
    city,
    toll,
    paymentMethod,
  } = req.body;
  const userId = req.user._id;

  try {
    let selectedCity = city;
    
    // Auto-detect city from pickupLocation if not provided
    if (!selectedCity && pickupLocation) {
      const cities = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Akure"];
      for (const c of cities) {
        if (pickupLocation.toLowerCase().includes(c.toLowerCase())) {
          selectedCity = c;
          break;
        }
      }
    }
    
    if (!selectedCity) selectedCity = "Lagos";

    const fare = parseFloat(calculateFare(selectedCity, distance, estimatedTime || 0));
    
    // Estimate fuel cost based on city rates (approximate from user data)
    const fuelRates = {
      Lagos: 202.5,
      Abuja: 112.5,
      "Port Harcourt": 189,
      Ibadan: 151.9,
      Akure: 135,
      default: 150
    };
    const fuelRate = fuelRates[selectedCity] || fuelRates.default;
    const estimatedFuelCost = distance * fuelRate;

    // Commission logic: 15% standard, 5% minimum if fuel > 40% of fare
    let commissionRate = 0.15;
    if (estimatedFuelCost > (fare * 0.40)) {
      commissionRate = 0.05;
    }

    const tollAmount = toll || 0;
    const commission = fare * commissionRate;
    const driverProfit = (fare + tollAmount) - (commission + estimatedFuelCost);

    const ride = new Ride({
      user: userId,
      pickupLocation,
      dropoffLocation,
      pickupCoordinates: {
        type: "Point",
        coordinates: pickupCoordinates,
      },
      dropoffCoordinates: {
        type: "Point",
        coordinates: dropoffCoordinates,
      },
      fare,
      toll: tollAmount,
      commission,
      fuelCost: estimatedFuelCost,
      driverProfit,
      city: selectedCity,
      vehicleType,
      distance,
      estimatedTime,
      pickupType,
      paymentMethod: paymentMethod || "Cash",
      scheduleTime: pickupType === "later" ? scheduleTime : null,
    });

    await ride.save();

    // Populate user details for driver notification
    const populatedRide = await Ride.findById(ride._id).populate("user", "firstName lastName profilePicture phone");

    // 1. Notify the passenger
    const user = await User.findById(userId);
    if (user) {
      await notifyUser(user, {
        event: "rideCreated",
        type: "ride_request",
        data: ride,
        subject: "Ride Requested - Moovr",
        message: `Your ride from ${pickupLocation} to ${dropoffLocation} has been requested. We are looking for a driver nearby.`,
      });
    }

    // 2. Find drivers within 5km radius
    let drivers = await User.find({
      role: "driver",
      availability: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [pickupCoordinates[0], pickupCoordinates[1]], // [longitude, latitude]
          },
          $maxDistance: 5000, // 5km
        },
      },
    }).select("firstName lastName profilePicture carCategory serviceType ratingAverage availability location");

    // 3. If no nearby drivers, notify all available drivers as a fallback
    if (!drivers || drivers.length === 0) {
      drivers = await User.find({ role: "driver", availability: true });
    }

    // 4. Notify available drivers about the new ride request
    const { sendSystemNotification } = require("../utils/notificationService");
    const notificationPayload = {
      ...populatedRide.toObject(),
      message: `New ride request from ${pickupLocation} to ${dropoffLocation}`,
    };

    drivers.forEach((driver) => {
      sendSystemNotification(driver._id, "newRide", notificationPayload, "New Ride Request");
    });

    // Schedule cancellation if not accepted within a time window
    setTimeout(async () => {
      const currentRide = await Ride.findById(ride._id);
      if (currentRide && currentRide.status === "pending") {
        currentRide.status = "cancelled";
        currentRide.updatedAt = Date.now();
        await currentRide.save();

        const user = await User.findById(userId);
        await notifyUser(user, {
          event: "rideCancelled",
          data: currentRide,
          subject: "Ride Cancelled - Moovr",
          message: "Your ride was cancelled as no driver accepted it in time.",
        });
      }
    }, 10 * 60 * 1000); // 10 minutes timeout for cancellation

    res.status(201).json({
      message: "Ride created successfully",
      ride,
    });
  } catch (error) {
    console.error("Error creating ride:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Accept Ride
exports.acceptRide = async (req, res) => {
  const { rideId } = req.params;
  const driverId = req.user._id;

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (ride.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Ride is not available for acceptance" });
    }

    ride.driver = driverId;
    ride.status = "accepted";
    ride.updatedAt = Date.now();
    await ride.save();

    const driver = req.user;
    // driver.rides.push(ride._id); // rides might be an array of IDs
    await User.findByIdAndUpdate(driver._id, { $push: { rides: ride._id } });

    // Populate ride details for notification
    const populatedRide = await Ride.findById(ride._id)
      .populate("user", "firstName lastName profilePicture phone")
      .populate("driver", "firstName lastName profilePicture phone vehicleInfo");

    // Fetch user details for notifications
    const user = await User.findById(ride.user);

    // Notify user via multi-channel
    await notifyUser(user, {
      event: "rideAccepted",
      data: populatedRide,
      subject: "Ride Accepted - Moovr",
      message: `Your ride from ${ride.pickupLocation} to ${ride.dropoffLocation} has been accepted by ${driver.firstName}.`,
    });

    const { sendSystemNotification } = require("../utils/notificationService");
    sendSystemNotification(driver._id, "rideAccepted", { ...populatedRide.toObject(), message: "You have accepted the ride." }, "Ride Accepted");

    res.status(200).json({ message: "Ride accepted successfully", ride: populatedRide });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error accepting ride", error: error.message });
  }
};

// Reject Ride
exports.rejectRide = async (req, res) => {
  const { rideId } = req.params;
  const driverId = req.user._id;

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (ride.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Ride cannot be rejected in its current state" });
    }

    // In a multi-driver system, rejecting usually means this driver won't see it again.
    // For now, we'll just mark it as cancelled or keep it pending but notify the user.
    // However, the user asked for "accept or reject rides".
    // If a driver rejects, maybe it should be available for others, or if it's a direct request, it's rejected.
    
    ride.status = "rejected";
    ride.updatedAt = Date.now();
    await ride.save();

    // Fetch user details for notifications
    const user = await User.findById(ride.user);
    const driver = req.user;

    // Notify user via multi-channel
    await notifyUser(user, {
      event: "rideRejected",
      data: ride,
      subject: "Ride Rejected - Moovr",
      message: `Your ride request from ${ride.pickupLocation} has been rejected by the driver.`,
    });

    const { sendSystemNotification } = require("../utils/notificationService");
    sendSystemNotification(driver._id, "rideRejected", { ...ride.toObject(), message: "You rejected the ride request." }, "Ride Rejected");

    res.status(200).json({ message: "Ride rejected successfully", ride });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error rejecting ride", error: error.message });
  }
};

// Cancel Ride (by User)
exports.cancelRide = async (req, res) => {
  const { rideId } = req.params;
  const userId = req.user._id;

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    // Check if the ride belongs to the user
    if (ride.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You are not authorized to cancel this ride" });
    }

    // Only allow cancellation if the ride is pending or accepted (but not started)
    if (ride.status === "running" || ride.status === "completed") {
      return res.status(400).json({ message: "Cannot cancel a ride that has already started or completed" });
    }

    const previousStatus = ride.status;
    ride.status = "cancelled";
    ride.updatedAt = Date.now();
    await ride.save();

    // Notify driver if the ride was already accepted
    if (previousStatus === "accepted" && ride.driver) {
      const driver = await User.findById(ride.driver);
      if (driver) {
        await notifyUser(driver, {
          event: "rideCancelled",
          data: ride,
          subject: "Ride Cancelled by User - Moovr",
          message: `The user has cancelled the ride from ${ride.pickupLocation} to ${ride.dropoffLocation}.`,
        });
      }
    }

    res.status(200).json({ message: "Ride cancelled successfully", ride });
  } catch (error) {
    res.status(500).json({ message: "Error cancelling ride", error: error.message });
  }
};

// Process Payment for Completed Ride
exports.processPayment = async (req, res) => {
  const { rideId } = req.params;
  const { paymentMethod } = req.body;
  const userId = req.user._id;

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (ride.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You are not authorized to pay for this ride" });
    }

    if (ride.paymentStatus === "paid") {
      return res.status(400).json({ message: "Ride is already paid" });
    }

    ride.paymentMethod = paymentMethod || ride.paymentMethod;
    let paymentData = {};

    try {
      if (ride.paymentMethod === "MoovR Wallet") {
        const wallet = await Wallet.findOne({ user: ride.user });
        if (!wallet || wallet.balance < ride.fare) {
          return res.status(400).json({ 
            message: "Insufficient wallet balance. Please top up.",
            required: ride.fare,
            balance: wallet ? wallet.balance : 0
          });
        }

        wallet.balance -= ride.fare;
        wallet.transactions.push({
          type: "debit",
          amount: ride.fare,
          description: `Payment for ride ${ride._id}`,
        });
        await wallet.save();

        if (ride.driver) {
          let driverWallet = await Wallet.findOne({ user: ride.driver });
          if (!driverWallet) {
            driverWallet = new Wallet({ user: ride.driver, balance: 0, transactions: [] });
          }
          driverWallet.balance += ride.driverProfit || 0;
          driverWallet.transactions.push({
            type: "credit",
            amount: ride.driverProfit || 0,
            description: `Payment for ride ${ride._id} (Wallet)`,
          });
          await driverWallet.save();
        }

        paymentData = { paymentStatus: "paid", method: "Wallet" };
        ride.paymentStatus = "paid";
      } else if (ride.paymentMethod === "Stripe" || ride.paymentMethod === "Debit Card" || ride.paymentMethod === "Google Pay") {
        const fareAmount = Math.round((ride.fare || 0) * 100);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "ngn",
                product_data: {
                  name: `Ride Payment - ${ride.pickupLocation} to ${ride.dropoffLocation}`,
                },
                unit_amount: fareAmount,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${frontendUrl}/ride/completed?rideId=${ride._id}&payment=success`,
          cancel_url: `${frontendUrl}/ride/completed?rideId=${ride._id}&payment=cancel`,
          metadata: {
            rideId: ride._id.toString(),
            userId: ride.user.toString(),
          },
        });
        paymentData = { paymentStatus: "pending", method: "Stripe", sessionId: session.id, paymentUrl: session.url };
      } else if (ride.paymentMethod === "Paystack") {
        const fareAmount = Math.round((ride.fare || 0) * 100);
        const response = await paystack.transaction.initialize({
          email: req.user.email,
          amount: fareAmount,
          metadata: {
            rideId: ride._id.toString(),
            userId: ride.user.toString(),
          },
        });
        paymentData = { 
          paymentStatus: "pending", 
          method: "Paystack", 
          authorization_url: response.data.authorization_url, 
          reference: response.data.reference 
        };
      } else if (ride.paymentMethod === "Cash") {
        if (ride.driver && ride.commission > 0) {
          let driverWallet = await Wallet.findOne({ user: ride.driver });
          if (!driverWallet) {
            driverWallet = new Wallet({ user: ride.driver, balance: 0, transactions: [] });
          }
          driverWallet.balance -= ride.commission;
          driverWallet.transactions.push({
            type: "debit",
            amount: ride.commission,
            description: `Commission for cash ride ${ride._id}`,
          });
          await driverWallet.save();
        }
        paymentData = { paymentStatus: "paid", method: "Cash" };
        ride.paymentStatus = "paid";
      }

      await ride.save();
      
      // Notify driver of payment status change
      if (ride.driver) {
        const { sendSystemNotification } = require("../utils/notificationService");
        sendSystemNotification(ride.driver, "paymentReceived", { 
          rideId: ride._id, 
          paymentStatus: ride.paymentStatus, 
          amount: ride.fare 
        }, "Payment Update");
      }

      res.status(200).json({ 
        message: "Payment processed successfully", 
        ride,
        ...paymentData
      });
    } catch (paymentError) {
      console.error("Payment Processing Error:", paymentError);
      res.status(500).json({ message: "Error processing payment", error: paymentError.message });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Update Ride Status
exports.updateRideStatus = async (req, res) => {
  const { rideId } = req.params;
  const { status } = req.body;

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    // Security: Only the assigned driver can update the status
    if (ride.driver && ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not authorized to update this ride status" });
    }

    let paymentData = {};

    // Payment Logic for Completed Rides
    if (status === "completed") {
      try {
        // If it's a Wallet ride, we MUST check balance if they want to pay with it
        if (ride.paymentMethod === "MoovR Wallet") {
          const wallet = await Wallet.findOne({ user: ride.user });
          if (!wallet || wallet.balance < ride.fare) {
            return res.status(400).json({ 
              message: "Insufficient wallet balance. User needs to top up before ride can be completed.",
              required: ride.fare,
              balance: wallet ? wallet.balance : 0
            });
          }
        }

        // If it's a Cash ride, we still handle commission immediately
        if (ride.paymentMethod === "Cash") {
          if (ride.driver && ride.commission > 0) {
            let driverWallet = await Wallet.findOne({ user: ride.driver });
            if (!driverWallet) {
              driverWallet = new Wallet({ user: ride.driver, balance: 0, transactions: [] });
            }
            driverWallet.balance -= ride.commission;
            driverWallet.transactions.push({
              type: "debit",
              amount: ride.commission,
              description: `Commission for cash ride ${ride._id}`,
            });
            await driverWallet.save();
          }
          paymentData = { paymentStatus: "paid", method: "Cash" };
          ride.paymentStatus = "paid";
        } else if (["Stripe", "Debit Card", "Google Pay"].includes(ride.paymentMethod)) {
          const fareAmount = Math.round((ride.fare || 0) * 100);
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
              {
                price_data: {
                  currency: "ngn",
                  product_data: {
                    name: `Ride Payment - ${ride.pickupLocation} to ${ride.dropoffLocation}`,
                  },
                  unit_amount: fareAmount,
                },
                quantity: 1,
              },
            ],
            mode: "payment",
            success_url: `${frontendUrl}/ride/completed?rideId=${ride._id}&payment=success`,
            cancel_url: `${frontendUrl}/ride/completed?rideId=${ride._id}&payment=cancel`,
            metadata: {
              rideId: ride._id.toString(),
              userId: ride.user.toString(),
            },
          });

          paymentData = {
            paymentStatus: "pending",
            method: "Stripe",
            sessionId: session.id,
            paymentUrl: session.url,
          };
          ride.paymentStatus = "pending";
        } else if (ride.paymentMethod === "Paystack") {
          const fareAmount = Math.round((ride.fare || 0) * 100);
          const response = await paystack.transaction.initialize({
            email: req.user.email,
            amount: fareAmount,
            metadata: {
              rideId: ride._id.toString(),
              userId: ride.user.toString(),
            },
          });
          paymentData = {
            paymentStatus: "pending",
            method: "Paystack",
            authorization_url: response.data.authorization_url,
            reference: response.data.reference,
          };
          ride.paymentStatus = "pending";
        } else {
          // Other fallback payment methods stay pending until explicit user request
          paymentData = { paymentStatus: "pending", method: ride.paymentMethod };
          ride.paymentStatus = "pending";
        }
        
        // Notify user to rate the driver
        const user = await User.findById(ride.user);
        if (user) {
          await notifyUser(user, {
            event: "rateDriverPrompt",
            type: "ride_complete",
            data: ride,
            subject: "Rate Your Ride - Moovr",
            message: `Your ride is complete! Please settle payment and rate your driver.`,
          });
        }
      } catch (paymentError) {
        console.error("General Payment Processing Error:", paymentError);
        paymentData = { paymentStatus: "error", message: paymentError.message };
      }
    }

    // Now update the status and save
    ride.status = status;
    ride.updatedAt = Date.now();
    await ride.save();

    // Fetch user details for notifications
    const user = await User.findById(ride.user);
    
    // Populate driver info for the notification data
    const populatedRide = await Ride.findById(ride._id).populate("driver", "firstName lastName profilePicture phone vehicleInfo");

    // Notify user via multi-channel
    await notifyUser(user, {
      event: "rideStatusUpdated",
      data: { ...populatedRide.toObject(), ...paymentData },
      subject: `Ride Status: ${status} - Moovr`,
      message: status === "completed" 
        ? `Your ride with ${populatedRide.driver?.firstName || 'the driver'} is complete!` 
        : `Your ride status has been updated to: ${status}.`,
    });

    if (ride.driver) {
      const driver = await User.findById(ride.driver);
      if (driver) {
        const { sendSystemNotification } = require("../utils/notificationService");
        sendSystemNotification(driver._id, "rideStatusUpdated", { ...ride.toObject(), message: `Ride status updated to ${status}` }, "Ride Updated");
      }
    }

    res.status(200).json({ 
      message: "Ride status updated successfully", 
      ride,
      ...paymentData
    });
  } catch (error) {
    console.error("Error updating ride status:", error);
    res.status(500).json({ message: "Error updating ride status", error: error.message });
  }
};

// Get Available Rides for Driver
exports.getAvailableRides = async (req, res) => {
  const driverCoordinates = req.user.location.coordinates; // Driver's current location
  console.log(driverCoordinates);

  try {
    const availableRides = await Ride.find({
      status: "pending", // Only fetch rides not accepted yet
      // Uncomment the below section if you want to filter by proximity
      // pickupCoordinates: {
      //   $near: {
      //     $geometry: {
      //       type: "Point",
      //       coordinates: driverCoordinates,
      //     },
      //     $maxDistance: 5000, // 5km radius
      //   },
      // },
    }).populate("user", "firstName lastName profilePicture phone").sort({ createdAt: 1 });

    console.log(availableRides);

    res.status(200).json({
      message: "Available rides fetched successfully",
      availableRides,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching available rides",
      error: error.message,
    });
  }
};

// Get Rides by Driver
exports.getDriverRides = async (req, res) => {
  const driverId = req.user._id; // Assume the driver is authenticated

  try {
    const driverRides = await Ride.find({ driver: driverId }).populate("user", "firstName lastName profilePicture phone").sort({
      updatedAt: -1,
    });

    res.status(200).json({
      message: "Rides fetched successfully",
      driverRides: driverRides || [],
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching rides for the driver",
      error: error.message,
    });
  }
};

// Get Ride Status
exports.getRideStatus = async (req, res) => {
  const { rideId } = req.params;

  try {
    const ride = await Ride.findById(rideId).populate("user", "firstName lastName profilePicture phone").populate("driver", "firstName lastName profilePicture phone vehicleInfo");
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    res.status(200).json({ status: ride.status, ride });
  } catch (error) {
    res.status(500).json({ message: "Error fetching ride status", error: error.message });
  }
};

// Rate Ride
exports.rateRide = async (req, res) => {
  const { rideId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user._id;

  try {
    const ride = await Ride.findById(rideId).populate("driver user");
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    // Only the passenger who requested the ride can rate
    if (ride.user._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You are not authorized to rate this ride" });
    }

    if (ride.status !== "completed") {
      return res.status(400).json({ message: "Only completed rides can be rated" });
    }

    if (ride.isRated) {
      return res.status(400).json({ message: "Ride already rated" });
    }

    // Create review
    const review = new Review({
      rating,
      comment: comment || "",
      reviewer: userId,
      driver: ride.driver._id,
      ride: ride._id,
    });
    await review.save();

    // Attach review to driver and ride
    const driver = await User.findById(ride.driver._id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    driver.reviews = driver.reviews || [];
    driver.reviews.push(review._id);

    // Update rating summary
    driver.ratingCount = (driver.ratingCount || 0) + 1;
    driver.ratingAverage = ((driver.ratingAverage || 0) * (driver.ratingCount - 1) + rating) / driver.ratingCount;

    await driver.save();

    ride.isRated = true;
    await ride.save();

    // Notify driver about new rating
    await notifyUser(driver, {
      event: "newReview",
      data: { review, rideId: ride._id },
      subject: "You received a new review",
      message: `You received a ${rating}-star review for ride ${ride._id}`,
    });

    res.status(200).json({ message: "Review submitted successfully", review });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ message: "Error submitting review", error: error.message });
  }
};
