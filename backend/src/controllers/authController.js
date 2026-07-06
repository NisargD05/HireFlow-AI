const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger");
const {
  generateOTP,
  getOTPExpiryTime,
  hashOTP,
  isOTPMatch,
  sendOTPEmail
} = require("../services/otpEmailService");

const SELF_SERVICE_ROLES = ["admin", "interviewer"];
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_LOCK_MS = 10 * 60 * 1000;

const isUserVerified = (user) => user.emailVerified === true || user.isVerified === true;

const clearOTPFields = (user) => {
  user.otpCodeHash = undefined;
  user.otpExpiresAt = undefined;
  user.otpVerifyAttempts = 0;
  user.otpLockedUntil = undefined;
};

const createToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
};

const sendAuthResponse = (res, user, statusCode) => {
  const token = createToken(user._id);

  res.status(statusCode).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: isUserVerified(user),
      emailVerified: isUserVerified(user)
    }
  });
};

// New signup endpoint with OTP verification
const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    if (!SELF_SERVICE_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role selected" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (!isUserVerified(existingUser)) {
        return res.status(409).json({
          success: false,
          message: "Email is already registered but not verified. Please verify your email.",
          needsVerification: true,
          email: normalizedEmail
        });
      }

      return res.status(409).json({ success: false, message: "Email is already registered" });
    }

    const otp = generateOTP();
    const otpExpiresAt = getOTPExpiryTime();

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      emailVerified: false,
      isVerified: false,
      otpCodeHash: hashOTP(otp),
      otpExpiresAt,
      otpLastSentAt: new Date(),
      otpVerifyAttempts: 0,
      otpLockedUntil: undefined
    });

    try {
      await sendOTPEmail(normalizedEmail, otp, name.trim());
    } catch (emailError) {
      logger.error("Failed to send OTP email during signup", {
        userId: user._id.toString(),
        email: normalizedEmail,
        error: emailError.message
      });
      return res.status(502).json({
        success: false,
        message: "Account created, but we could not send the OTP email. Please use resend OTP.",
        needsVerification: true,
        email: normalizedEmail
      });
    }

    logger.info("User signed up with OTP verification", {
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });

    res.status(201).json({
      success: true,
      message: "OTP sent to your email. Please verify to complete signup.",
      email: normalizedEmail
    });
  } catch (error) {
    logger.error("Signup failed", {
      email: req.body?.email,
      error: error.message
    });
    res.status(500).json({ success: false, message: "Signup failed" });
  }
};

// Keep the old controller export without preserving the authentication bypass.
const register = (req, res) => signup(req, res);

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (isUserVerified(user)) {
      return res.status(400).json({ success: false, message: "Email already verified" });
    }

    if (user.otpLockedUntil && new Date() < new Date(user.otpLockedUntil)) {
      return res.status(429).json({
        success: false,
        message: "Too many invalid attempts. Please request a new OTP or try again later."
      });
    }

    if (!user.otpExpiresAt || new Date() > new Date(user.otpExpiresAt)) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    if (!user.otpCodeHash || !isOTPMatch(otp, user.otpCodeHash)) {
      user.otpVerifyAttempts = (user.otpVerifyAttempts || 0) + 1;

      if (user.otpVerifyAttempts >= OTP_MAX_VERIFY_ATTEMPTS) {
        user.otpLockedUntil = new Date(Date.now() + OTP_LOCK_MS);
      }

      await user.save();
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    user.emailVerified = true;
    user.isVerified = true;
    clearOTPFields(user);
    await user.save();

    logger.info("User email verified", {
      userId: user._id.toString(),
      email: user.email
    });

    res.json({
      success: true,
      message: "Email verified successfully. You can now login."
    });
  } catch (error) {
    logger.error("OTP verification failed", {
      email: req.body?.email,
      error: error.message
    });
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};

// Resend OTP with cooldown
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (isUserVerified(user)) {
      return res.status(400).json({ success: false, message: "Email already verified" });
    }

    if (user.otpLastSentAt) {
      const timeSinceLastOTP = Date.now() - new Date(user.otpLastSentAt).getTime();
      if (timeSinceLastOTP < OTP_RESEND_COOLDOWN_MS) {
        const waitTime = Math.ceil((OTP_RESEND_COOLDOWN_MS - timeSinceLastOTP) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitTime} seconds before requesting a new OTP`
        });
      }
    }

    const otp = generateOTP();
    const otpExpiresAt = getOTPExpiryTime();

    user.otpCodeHash = hashOTP(otp);
    user.otpExpiresAt = otpExpiresAt;
    user.otpLastSentAt = new Date();
    user.otpVerifyAttempts = 0;
    user.otpLockedUntil = undefined;
    await user.save();

    try {
      await sendOTPEmail(normalizedEmail, otp, user.name);
    } catch (emailError) {
      logger.error("Failed to send OTP email during resend", {
        userId: user._id.toString(),
        email: normalizedEmail,
        error: emailError.message
      });
      return res.status(502).json({ success: false, message: "Failed to send OTP email" });
    }

    logger.info("OTP resent", {
      userId: user._id.toString(),
      email: user.email
    });

    res.json({
      success: true,
      message: "OTP sent to your email"
    });
  } catch (error) {
    logger.error("Resend OTP failed", {
      email: req.body?.email,
      error: error.message
    });
    res.status(500).json({ success: false, message: "Failed to resend OTP" });
  }
};

// Modified login to check verification
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      logger.warn("Login failed: user not found", { email: normalizedEmail });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if email is verified
    if (!isUserVerified(user)) {
      logger.warn("Login failed: email not verified", {
        userId: user._id.toString(),
        email: user.email
      });
      return res.status(403).json({ message: "Please verify your email first" });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      logger.warn("Login failed: invalid password", {
        userId: user._id.toString(),
        email: user.email
      });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    logger.info("User logged in", {
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });

    sendAuthResponse(res, user, 200);
  } catch (error) {
    logger.error("Login failed unexpectedly", {
      email: req.body?.email,
      error: error.message
    });
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

const getMe = async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      isVerified: isUserVerified(req.user),
      emailVerified: isUserVerified(req.user)
    }
  });
};

module.exports = {
  register,
  signup,
  verifyOTP,
  resendOTP,
  login,
  getMe
};
