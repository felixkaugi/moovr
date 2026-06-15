const CarListing = require("../models/carListing");
const User = require("../models/User");

// Rent a Car
exports.rentCar = async (req, res) => {
  const { carId, deliveryLocation, rentStartDate, rentEndDate } = req.body;
  const userId = req.user._id;
  console.log(req.body);

  try {
    const carListing = await CarListing.findById(carId);

    if (!carListing) {
      return res.status(404).json({ message: "Car listing not found" });
    }

    // Check if the car is available for the specified period
    const isAvailable = carListing.rentalPeriods.every((period) => {
      return (
        new Date(rentStartDate) > new Date(period.endDate) ||
        new Date(rentEndDate) < new Date(period.startDate)
      );
    });

    if (!isAvailable) {
      return res
        .status(400)
        .json({ message: "Car is not available for the specified period" });
    }

    // Add the rental period to the car listing
    carListing.rentalPeriods.push({
      startDate: new Date(rentStartDate),
      endDate: new Date(rentEndDate),
      user: userId,
      deliveryLocation,
    });

    carListing.isAvailable = false; // Mark the car as not available

    await carListing.save();

    res.status(200).json({ message: "Car rented successfully", carListing });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get Rental Periods for a Car
exports.getRentalPeriods = async (req, res) => {
  const { carId } = req.params;

  try {
    const carListing = await CarListing.findById(carId);

    if (!carListing) {
      return res.status(404).json({ message: "Car listing not found" });
    }

    res.status(200).json({ rentalPeriods: carListing.rentalPeriods });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get Total Rented Cars by a Specific User
exports.getTotalRentedCarsByUser = async (req, res) => {
  const userId = req.user._id;

  try {
    const carListings = await CarListing.find({ "rentalPeriods.user": userId });
    const totalRentedCars = carListings.length;

    res.status(200).json({ totalRentedCars });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get Total Number of Rented Cars
exports.getTotalRentedCars = async (req, res) => {
  try {
    const carListings = await CarListing.find({
      "rentalPeriods.0": { $exists: true },
    });
    const totalRentedCars = carListings.length;

    res.status(200).json({ totalRentedCars });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get Currently Rented Cars
exports.getCurrentlyRentedCars = async (req, res) => {
  const currentDate = new Date();

  try {
    const carListings = await CarListing.find({
      rentalPeriods: {
        $elemMatch: {
          startDate: { $lte: currentDate },
          endDate: { $gte: currentDate },
        },
      },
    });

    res.status(200).json({ currentlyRentedCars: carListings });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get Rented Cars of a Specific Driver
exports.getRentedCarsByDriver = async (req, res) => {
  const { driverId } = req.params;

  try {
    const carListings = await CarListing.find({
      "rentalPeriods.user": driverId,
    });

    res.status(200).json({ rentedCars: carListings });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
