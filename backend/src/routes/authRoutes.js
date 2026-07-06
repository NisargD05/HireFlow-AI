const express = require("express");
const {
  signup,
  verifyOTP,
  resendOTP,
  login,
  getMe
} = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Keep the legacy URL, but require the same OTP flow as the current signup endpoint.
router.post("/register", signup);
router.post("/login", login);

// New OTP verification flow
router.post("/signup", signup);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);

router.get("/me", protect, getMe);

module.exports = router;
