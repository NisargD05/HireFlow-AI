const app = require("./app");
const connectDB = require("./config/db");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  logger.error("JWT_SECRET is missing. Authentication cannot start safely.");
  process.exit(1);
}

connectDB();

const server = app.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`Port ${PORT} is already in use. Stop the existing backend or choose another PORT.`, {
      port: PORT
    });
    process.exit(1);
  }

  logger.error("Backend server failed to start", { error: error.message });
  process.exit(1);
});
