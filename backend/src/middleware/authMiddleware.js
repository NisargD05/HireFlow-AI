const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("Protected route rejected: missing bearer token", {
        method: req.method,
        path: req.originalUrl
      });
      return res.status(401).json({ message: "Not authorized, token missing" });
    }

    if (!process.env.JWT_SECRET) {
      logger.error("JWT verification failed: JWT_SECRET is missing");
      return res.status(500).json({ message: "JWT_SECRET is not configured on the server" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      logger.warn("Protected route rejected: token user not found", {
        userId: decoded.userId,
        path: req.originalUrl
      });
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    if (user.emailVerified !== true && user.isVerified !== true) {
      logger.warn("Protected route rejected: email not verified", {
        userId: user._id.toString(),
        path: req.originalUrl
      });
      return res.status(403).json({ message: "Please verify your email first" });
    }

    req.user = user;
    next();
  } catch (error) {
    const isExpired = error.name === "TokenExpiredError";
    logger.warn("Protected route rejected: token verification failed", {
      path: req.originalUrl,
      error: error.message,
      name: error.name
    });
    res.status(401).json({
      message: isExpired ? "Not authorized, token expired" : "Not authorized, token invalid",
      error: error.message
    });
  }
};

module.exports = protect;
