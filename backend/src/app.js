const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();
const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const knowledgeBaseRoutes = require("./routes/knowledgeBaseRoutes");
const interviewerRoutes = require("./routes/interviewerRoutes");
const interviewRequestRoutes = require("./routes/interviewRequestRoutes");
const interviewRoutes = require("./routes/interviewRoutes");
const interviewAgentRoutes = require("./routes/interviewAgentRoutes");
const candidateRoutes = require("./routes/candidateRoutes");
const shortlistedCandidateRoutes = require("./routes/shortlistedCandidateRoutes");
const externalApplicationRoutes = require("./routes/externalApplicationRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const { tallyWebhook } = require("./controllers/externalApplicationController");
const logger = require("./utils/logger");

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use((req, res, next) => {
  logger.info("HTTP request", {
    method: req.method,
    path: req.originalUrl,
    userAgent: req.headers["user-agent"]
  });
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "AI Hiring System API is running" });
});

app.post("/", (req, res) => {
  if (req.headers["user-agent"] === "Tally Webhooks" || req.body?.eventType === "FORM_RESPONSE") {
    return tallyWebhook(req, res);
  }

  return res.status(404).json({
    message: "API route not found",
    path: req.originalUrl,
    method: req.method
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "backend",
    mongoUriConfigured: Boolean(process.env.MONGO_URI),
    jwtConfigured: Boolean(process.env.JWT_SECRET),
    aiServiceUrl: process.env.AI_SERVICE_URL || null
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/knowledge-base", knowledgeBaseRoutes);
app.use("/api/interviewer", interviewerRoutes);
app.use("/api/interview-requests", interviewRequestRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/interview-agent", interviewAgentRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/shortlisted-candidates", shortlistedCandidateRoutes);
app.use("/api/external-applications", externalApplicationRoutes);
app.use("/api/webhooks", webhookRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "API route not found",
    path: req.originalUrl,
    method: req.method
  });
});

app.use((error, req, res, next) => {
  logger.error("Unhandled API error", {
    method: req.method,
    path: req.originalUrl,
    error: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });

  if (error.message === "Only PDF files are allowed") {
    return res.status(400).json({
      message: "Upload rejected: only PDF files are allowed",
      error: error.message
    });
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      message: "Upload rejected: PDF file exceeds the 10MB limit",
      error: error.message
    });
  }

  if (req.originalUrl?.startsWith("/api/webhooks/")) {
    return res.status(200).json({
      success: false,
      accepted: false,
      message: error.message || "Webhook request failed before handler",
      error: error.type || error.name || "WebhookRequestError"
    });
  }

  res.status(error.status || 500).json({
    message: error.message || "Internal server error",
    error: process.env.NODE_ENV === "production" ? undefined : error.message
  });
});

module.exports = app;
