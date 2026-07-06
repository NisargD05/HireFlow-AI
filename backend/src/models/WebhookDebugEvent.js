const mongoose = require("mongoose");

const webhookDebugEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["tally", "typeform"],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["received", "stored", "invalid", "failed"],
      default: "received",
      index: true
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null,
      index: true
    },
    rawJobId: {
      type: String,
      default: ""
    },
    role: {
      type: String,
      default: ""
    },
    candidateName: {
      type: String,
      default: ""
    },
    email: {
      type: String,
      default: ""
    },
    resumeUrl: {
      type: String,
      default: ""
    },
    resumeDetected: {
      type: Boolean,
      default: false
    },
    importStatus: {
      type: String,
      enum: ["not_started", "pending", "pending_failed", "downloading", "downloaded", "parsed", "ranked", "imported", "completed", "duplicate", "failed"],
      default: "not_started",
      index: true
    },
    candidateImported: {
      type: Boolean,
      default: false
    },
    importedCandidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      default: null
    },
    formId: {
      type: String,
      default: ""
    },
    submissionId: {
      type: String,
      default: ""
    },
    parsedFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    webhookPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    error: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

webhookDebugEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model("WebhookDebugEvent", webhookDebugEventSchema);
