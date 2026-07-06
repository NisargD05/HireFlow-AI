const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is missing from environment variables");
    }

    await mongoose.connect(mongoUri);
    logger.info("MongoDB connected", {
      host: mongoose.connection.host,
      database: mongoose.connection.name
    });
  } catch (error) {
    logger.error("MongoDB connection failed", {
      error: error.message
    });
    process.exit(1);
  }
};

module.exports = connectDB;
