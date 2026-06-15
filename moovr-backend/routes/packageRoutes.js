const express = require("express");
const router = express.Router();
const { protect, allowDriver, isDriver } = require("../middleware/authMiddleware");
const {
  createPackage,
  acceptPackage,
  updatePackageStatus,
  getAvailablePackages,
  getCurrentRunningPackage,
  getPackageStatus,
} = require("../controllers/packageController");

// Create Package
router.post("/create", protect, createPackage);

// Accept Package
router.post("/accept/:packageId", protect, allowDriver, acceptPackage);

// Update Package Status
router.put("/status/:packageId", protect, allowDriver, updatePackageStatus);

// Get Package Status
router.get("/status/:packageId", protect, getPackageStatus);

router.get("/available", protect, isDriver, getAvailablePackages);

router.get("/current", protect, allowDriver, getCurrentRunningPackage);

module.exports = router;
