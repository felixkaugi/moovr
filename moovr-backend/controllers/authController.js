const User = require("../models/User");
const DrivingLicense = require("../models/DrivingLicense");
const ProofOfResidency = require("../models/ProofOfResidency");
const VehicleInsurance = require("../models/VehicleInsurance");
const VehicleRegistrationBook = require("../models/VehicleRegistrationBook");
const generateToken = require("../utils/generateToken"); // Import JWT token generator
const { uploadImage } = require("../utils/firebaseStorage"); // Import the uploadImage function
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");

// 1. **Check if user exists**
exports.checkUser = async (req, res) => {
  const { phone, email } = req.body;
  try {
    let user = null;
    if (phone) {
      user = await User.findOne({ phone });
    } else if (email) {
      user = await User.findOne({ email });
    }

    if (user) {
      return res.status(200).json({ 
        exists: true, 
        isRegistered: !!(user.firstName && user.lastName),
        user 
      });
    }
    res.status(200).json({ exists: false });
  } catch (error) {
    res.status(500).json({ message: "Error checking user", error: error.message });
  }
};

// 2. **Verify Firebase Token**
exports.firebaseVerify = async (req, res) => {
  const { idToken, role, phone: bodyPhone, name: bodyName } = req.body;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { phone_number, email, uid, name } = decodedToken;
    const displayName = name || decodedToken.displayName || bodyName || "";
    const [firstName, ...lastNameParts] = displayName.trim().split(" ");
    const lastName = lastNameParts.join(" ");
    const phone = bodyPhone || phone_number;

    // Build query carefully to avoid matching null/undefined fields
    const queryConditions = [{ firebaseUid: uid }];
    if (email) queryConditions.push({ email });
    if (phone) queryConditions.push({ phone });

    let user = await User.findOne({
      $or: queryConditions,
    }).populate(
      "documents.drivingLicense documents.proofOfResidency documents.vehicleRegistrationBook documents.vehicleInsurance"
    );

    if (!user) {
      user = new User({
        phone: phone || `firebase_${uid}`,
        email,
        firebaseUid: uid,
        role: role || "user",
        isVerified: true,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });
      await user.save();
    } else {
      user.isVerified = true;
      if (email && !user.email) user.email = email;
      if (phone && !user.phone) user.phone = phone;
      if (!user.firebaseUid) user.firebaseUid = uid;

      if (!user.firstName && firstName) user.firstName = firstName;
      if (!user.lastName && lastName) user.lastName = lastName;

      // ✅ Update role if provided and different
      if (role && user.role !== role) {
        user.role = role;
      }

      await user.save();
    }

    const isRegistered = !!(user.firstName && user.lastName);
    const token = isRegistered ? generateToken(user) : null;

    res.status(200).json({
      message: "Firebase token verified",
      token,
      user,
      isRegistered,
    });
  } catch (error) {
    console.error("Firebase Verify Error:", error);
    res.status(401).json({ 
      message: "Invalid Firebase token", 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// 3. **Google Login/Link**
exports.googleLogin = async (req, res) => {
  const { idToken, role } = req.body;
  console.log("Google Login request received. Role:", role, "Token exists:", !!idToken);
  try {
    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if token belongs to the expected project
    const envProjectId = process.env.VITE_FIREBASE_PROJECT_ID || "moovr-73876";
    const tokenAudience = decodedToken.aud || decodedToken.iss?.split('/').pop();
    
    if (tokenAudience !== envProjectId) {
      console.error(`Audience mismatch! Token project: ${tokenAudience}, Expected: ${envProjectId}`);
      return res.status(500).json({
        message: "Google login failed: Audience mismatch",
        error: `Token belongs to project ${tokenAudience}, but backend expects ${envProjectId}`,
        code: "AUDIENCE_MISMATCH"
      });
    }

    const { email, name, picture, uid } = decodedToken;
    console.log("Decoded Google ID Token successfully:", email, "UID:", uid);

    // Build query carefully to avoid matching null/undefined fields
    const queryConditions = [{ firebaseUid: uid }];
    if (email) queryConditions.push({ email });

    let user = await User.findOne({
      $or: queryConditions,
    }).populate(
      "documents.drivingLicense documents.proofOfResidency documents.vehicleRegistrationBook documents.vehicleInsurance"
    );

    if (!user) {
      console.log("User not found, creating new user for email:", email);
      // User doesn't exist, create a new record
      user = new User({
        email,
        firebaseUid: uid,
        firstName: name ? name.split(' ')[0] : 'User',
        lastName: name ? name.split(' ').slice(1).join(' ') : '',
        profilePicture: picture,
        role: role || "user",
        isVerified: true
      });
      await user.save();
      console.log("New user created via Google:", email);
    } else {
      console.log("Existing user found for email/uid:", email);
      // Update firebaseUid if it's not set
      if (!user.firebaseUid) {
        user.firebaseUid = uid;
      }

      // If a role was requested (e.g., driver) and differs from current, update it
      if (role && user.role !== role) {
        console.log(`Updating user role from ${user.role} to ${role}`);
        user.role = role;
      }

      await user.save();
    }

    // User exists (or was just created), log them in
    const isRegistered = !!(user.firstName && user.lastName && user.phone);
    const token = generateToken(user);

    return res.status(200).json({ 
      message: "Login successful", 
      token, 
      user,
      isRegistered 
    });
  } catch (error) {
    console.error("Google Login Error details:", {
      message: error.message,
      code: error.code
    });
    return res.status(500).json({ 
      message: "Google login failed at backend", 
      error: error.message, 
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? error : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// 4. **Verify Phone & Send OTP (Legacy route - Firebase now handles phone authentication)**
exports.verifyPhone = async (req, res) => {
  return res.status(410).json({
    message:
      "Phone verification via Twilio is no longer supported. Use Firebase Authentication instead.",
  });
};

// 2. **Verify OTP and return JWT token (Legacy route)**
exports.verifyOTP = async (req, res) => {
  return res.status(410).json({
    message:
      "OTP verification via backend is no longer supported. Use Firebase Authentication and /auth/firebase-verify instead.",
  });
};

// Register User
exports.registerUser = async (req, res) => {
  const {
    phone,
    role,
    firstName,
    lastName,
    city,
    driverType,
    serviceType,
    carCategory,
    referralCode,
  } = req.body;

  if (!phone || !firstName || !lastName)
    return res
      .status(400)
      .json({ message: "Please provide all the details required" });

  let userRole = role;
  if (!userRole || !["user", "driver", "admin"].includes(userRole)) {
    userRole = "user";
  }

  let existingUser = await User.findOne({ phone });
  if (!existingUser) {
    return res.status(404).json({
      message: "Phone number is not verified, Please verify phone first.",
    });
  }

  console.log(existingUser);
  if (existingUser.firstName && existingUser.lastName) {
    return res.status(400).json({
      message: "User is already registered, Please proceed to login.",
    });
  }

  if (userRole === "driver") {
    if (!driverType || !serviceType || !carCategory) {
      return res.status(400).json({
        message:
          "driverType, serviceType, and carCategory are required for driver role",
      });
    }
  } else {
    if (driverType || serviceType || carCategory) {
      return res.status(400).json({
        message:
          "driverType, serviceType, and carCategory should not be provided for user/admin role",
      });
    }
  }

  try {
    existingUser.role = userRole;
    existingUser.firstName = firstName;
    existingUser.lastName = lastName;
    existingUser.referralCode = referralCode || "";
    existingUser.city = city || existingUser.city;
    existingUser.driverType =
      userRole === "driver" ? driverType : existingUser.driverType;
    existingUser.serviceType =
      userRole === "driver" ? serviceType : existingUser.serviceType;
    existingUser.carCategory =
      userRole === "driver" ? carCategory : existingUser.carCategory;

    await existingUser.save();

    // Generate JWT Token
    const token = generateToken(existingUser);

    res.status(200).json({
      message: "User Registered successfully",
      user: existingUser,
      token,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// 4. **Login User (verify OTP and login, then return JWT)**
exports.loginUser = async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ message: "Phone and OTP are required" });
  }

  try {
    const user = await User.findOne({ phone });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found. Please register first." });
    }

    if (user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Generate JWT Token
    const token = generateToken(user);

    res.status(200).json({ message: "Login successful", token, user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Admin Login
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    let user = await User.findOne({ email, role: "admin" });

    // For first time setup, if no admin exists, we can create one or use a default
    // In a real app, this should be a seeding script
    if (!user && email === "admin@admin.com" && password === "admin") {
       const hashedPassword = await bcrypt.hash("admin", 10);
       user = new User({
         email: "admin@admin.com",
         password: hashedPassword,
         role: "admin",
         firstName: "Admin",
         lastName: "User",
         isVerified: true
       });
       await user.save();
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.status(200).json({ 
      message: "Admin login successful", 
      token,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// 5. **Get User by ID**
exports.getUser = async (req, res) => {
  const id = req.user._id; // Get the user ID from the decoded token attached to the request

  try {
    const user = await User.findById(id).populate(
      "documents.drivingLicense documents.proofOfResidency documents.vehicleRegistrationBook documents.vehicleInsurance"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// exports.updateUser = async (req, res) => {
//   const id = req.user._id; // Get the user ID from the decoded token attached to the request
//   const {
//     role,
//     firstName,
//     lastName,
//     city,
//     driverType,
//     serviceType,
//     carCategory,
//     email,
//   } = req.body;

//   try {
//     const user = await User.findById(id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     // If role is changed to driver, ensure required fields are provided
//     // if (role && role === "driver") {
//     //   if (!driverType || !serviceType || !carCategory) {
//     //     return res.status(400).json({
//     //       message:
//     //         "driverType, serviceType, and carCategory are required for driver role",
//     //     });
//     //   }
//     // } else {
//     //   // If role is not driver, make sure to nullify the driver-related fields
//     //   if (driverType || serviceType || carCategory) {
//     //     return res.status(400).json({
//     //       message:
//     //         "driverType, serviceType, and carCategory should not be updated for user/admin role",
//     //     });
//     //   }
//     // }

//     // Update fields
//     user.firstName = firstName || user.firstName;
//     user.lastName = lastName || user.lastName;
//     user.city = city || user.city;
//     user.email = email || user.email;

//     if (role) user.role = role;
//     if (role === "driver") {
//       user.driverType = driverType || user.driverType;
//       user.serviceType = serviceType || user.serviceType;
//       user.carCategory = carCategory || user.carCategory;
//     } else {
//       user.driverType = null;
//       user.serviceType = null;
//       user.carCategory = null;
//     }

//     await user.save();
//     res.status(200).json({ message: "User updated successfully", user });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };

// Update User
exports.updateUser = async (req, res) => {
  const id = req.user._id; // Get the user ID from the decoded token attached to the request
  const { firstName, lastName, email } = req.body; // Only take these fields from the request body

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update only firstName, lastName, and email
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.email = email || user.email;

    // Save the user
    await user.save();
    res.status(200).json({ message: "User updated successfully", user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Update FCM Token
exports.updateFCMToken = async (req, res) => {
  const { fcmToken } = req.body;
  const userId = req.user._id;

  if (!fcmToken) {
    return res.status(400).json({ message: "fcmToken is required" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { fcmToken, updatedAt: Date.now() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "FCM Token updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating FCM Token", error: error.message });
  }
};

exports.updateDriverAvailability = async (req, res) => {
  const { availability } = req.body;
  const driverId = req.user._id;

  try {
    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    driver.availability = availability;
    await driver.save();

    res.status(200).json({ message: "Driver availability updated", driver });
  } catch (error) {
    res.status(500).json({
      message: "Error updating driver availability",
      error: error.message,
    });
  }
};

// Get All Drivers
exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await User.find({
      role: "driver",
    });
    res.status(200).json({ drivers });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching drivers", error: error.message });
  }
};

// Get Available Drivers
exports.getAvailableDrivers = async (req, res) => {
  try {
    const availableDrivers = await User.find({
      role: "driver",
      availability: true,
      verificationStatus: "approved",
    });

    if (availableDrivers.length === 0) {
      return res.status(404).json({
        message: "No drivers are currently available",
      });
    }

    res.status(200).json({ availableDrivers });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching available drivers",
      error: error.message,
    });
  }
};

// 7. **Delete User**
exports.deleteUser = async (req, res) => {
  const id = req.user._id; // Get the user ID from the decoded token attached to the request

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Use deleteOne instead of remove
    await User.deleteOne({ _id: id });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// 8. **Get All Users**
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json({ users });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Update Profile Picture
exports.updateProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const imageUrl = await uploadImage(req.file.buffer);

    // Assuming you have a User model and the user is authenticated
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.profilePicture = imageUrl;
    await user.save();

    res.json({ message: "Profile picture updated", imageUrl });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

// Update Driver Location
// exports.updateLocation = async (req, res) => {
//   const { coordinates } = req.body;
//   const driverId = req.user._id;

//   try {
//     const driver = await User.findById(driverId);
//     if (!driver) {
//       return res.status(404).json({ message: "Driver not found" });
//     }

//     driver.location = {
//       type: "Point",
//       coordinates,
//     };
//     await driver.save();

//     res.status(200).json({ message: "Location updated successfully", driver });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Error updating location", error: error.message });
//   }
// };

exports.updateDriverLocation = async (req, res) => {
  const { latitude, longitude } = req.body;
  const driverId = req.user._id;

  try {
    await User.findByIdAndUpdate(driverId, {
      location: {
        type: "Point",
        coordinates: [longitude, latitude], // GeoJSON format: [longitude, latitude]
      },
      updatedAt: Date.now(),
    });

    res.status(200).json({ message: "Driver location updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating location", error: error.message });
  }
};

exports.updatePassengerLocation = async (req, res) => {
  const { latitude, longitude } = req.body;
  const userId = req.user._id;

  try {
    await User.findByIdAndUpdate(userId, {
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      updatedAt: Date.now(),
    });

    res.status(200).json({ message: "Passenger location updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating location", error: error.message });
  }
};

exports.getPassengerLocation = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).select("location firstName lastName role");
    if (!user) {
      return res.status(404).json({ message: "Passenger not found" });
    }

    res.status(200).json({
      location: user.location,
      userId: user._id,
      name: `${user.firstName} ${user.lastName}`,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching passenger location", error: error.message });
  }
};

// Disable/Enable User (Admin)
exports.disableUser = async (req, res) => {
  const { id, status } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.isVerified = status;
    await user.save();

    res.status(200).json({ success: true, message: `User ${status ? "enabled" : "disabled"} successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Disable/Enable Driver (Admin)
exports.disableDriver = async (req, res) => {
  const { id, status } = req.body;
  try {
    const driver = await User.findById(id);
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

    driver.isVerified = status;
    // Also update verificationStatus if needed
    if (status) {
      driver.verificationStatus = "approved";
    } else {
      // Use 'rejected' or just keep 'approved' but set isVerified to false
      // Since 'disabled' is not in enum, we use 'rejected' or just don't change it if it's already approved
      if (driver.verificationStatus !== "approved") {
        driver.verificationStatus = "rejected";
      }
    }
    await driver.save();

    res.status(200).json({ success: true, message: `Driver ${status ? "enabled" : "disabled"} successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Pending Drivers (Admin)
exports.getPendingDrivers = async (req, res) => {
  try {
    const pendingDrivers = await User.find({
      role: "driver",
      verificationStatus: "pending",
    }).populate("documents.drivingLicense documents.cnicFront documents.vehicleRegistrationBook documents.vehicleInsurance");
    res.status(200).json({ success: true, drivers: pendingDrivers });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching pending drivers", error: error.message });
  }
};

// Update Driver Verification Status (Admin)
exports.updateVerificationStatus = async (req, res) => {
  const { id, status } = req.body; // status should be 'approved' or 'rejected'
  try {
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    const driver = await User.findById(id);
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

    driver.verificationStatus = status;
    driver.isVerified = status === "approved";
    await driver.save();

    res.status(200).json({ success: true, message: `Driver verification status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Edit Driver
exports.adminEditDriver = async (req, res) => {
  const { id } = req.params;
  const {
    firstName,
    lastName,
    email,
    phone,
    city,
    driverType,
    serviceType,
    carCategory,
    verificationStatus,
    isVerified,
    hourlyPrice
  } = req.body;

  try {
    const driver = await User.findById(id);
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

    // Update fields if provided
    if (firstName) driver.firstName = firstName;
    if (lastName) driver.lastName = lastName;
    if (email) driver.email = email;
    if (phone) driver.phone = phone;
    if (city) driver.city = city;
    if (driverType) driver.driverType = driverType;
    if (serviceType) driver.serviceType = serviceType;
    if (carCategory) driver.carCategory = carCategory;
    if (verificationStatus) driver.verificationStatus = verificationStatus;
    if (typeof isVerified !== 'undefined') driver.isVerified = isVerified;
    if (typeof hourlyPrice !== 'undefined') driver.hourlyPrice = hourlyPrice;

    driver.updatedAt = Date.now();
    await driver.save();

    res.status(200).json({ success: true, message: "Driver details updated successfully", driver });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating driver details", error: error.message });
  }
};

// Admin Delete Driver
exports.adminDeleteDriver = async (req, res) => {
  const { id } = req.params;

  try {
    const driver = await User.findById(id);
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });

    await User.deleteOne({ _id: id });
    res.status(200).json({ success: true, message: "Driver deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting driver", error: error.message });
  }
};
