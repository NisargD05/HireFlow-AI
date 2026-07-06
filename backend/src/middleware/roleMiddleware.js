const logger = require("../utils/logger");

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn("Role authorization rejected", {
        userId: req.user._id.toString(),
        role: req.user.role,
        allowedRoles,
        path: req.originalUrl
      });
      return res.status(403).json({
        message: "Forbidden: insufficient permissions",
        requiredRoles: allowedRoles,
        currentRole: req.user.role
      });
    }

    next();
  };
};

module.exports = authorizeRoles;
