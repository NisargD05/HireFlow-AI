const mongoose = require("mongoose");

const externalApplicationSubmissionSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true
    },
    formId: {
      type: String,
      trim: true,
      default: ""
    },
    submissionId: {
      type: String,
      trim: true,
      default: ""
    },
    role: {
      type: String,
      trim: true,
      default: ""
    },
    candidateName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    linkedinUrl: {
      type: String,
      trim: true,
      default: ""
    },
    githubUrl: {
      type: String,
      trim: true,
      default: ""
    },
    portfolioUrl: {
      type: String,
      trim: true,
      default: ""
    },
    experience: {
      type: String,
      trim: true,
      default: ""
    },
    currentCompany: {
      type: String,
      trim: true,
      default: ""
    },
    resumeUrl: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: String,
      trim: true,
      default: "tally"
    },
    webhookPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    importStatus: {
      type: String,
      enum: ["pending", "pending_failed", "downloading", "downloaded", "parsed", "ranked", "imported", "completed", "failed", "duplicate"],
      default: "pending",
      index: true
    },
    importedCandidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      default: null
    },
    importError: {
      type: String,
      default: ""
    },
    importedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

externalApplicationSubmissionSchema.index(
  { submissionId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { submissionId: { $type: "string", $gt: "" } } }
);
externalApplicationSubmissionSchema.index({ jobId: 1, email: 1 }, { unique: true });
externalApplicationSubmissionSchema.index({ jobId: 1, importStatus: 1, createdAt: -1 });

module.exports = mongoose.model("ExternalApplicationSubmission", externalApplicationSubmissionSchema);
