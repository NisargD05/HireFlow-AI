const mongoose = require("mongoose");

const preferredWindowSchema = new mongoose.Schema(
  {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  { _id: false }
);

const interviewRequestSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true
    },
    candidateName: {
      type: String,
      default: "",
      trim: true
    },
    candidateEmail: {
      type: String,
      default: "",
      lowercase: true,
      trim: true
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true
    },
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    interviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    interviewerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    roundType: {
      type: String,
      enum: ["HR Round", "Technical Round", "System Design Round", "Managerial Round", "Final Round"],
      required: true
    },
    duration: {
      type: Number,
      required: true,
      min: 15,
      max: 240
    },
    preferredWindow: {
      type: preferredWindowSchema,
      required: true
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    },
    status: {
      type: String,
      enum: [
        "pending",
        "awaiting_interviewer_slot",
        "email_pending",
        "email_sent",
        "email_failed",
        "scheduled",
        "completed",
        "feedback_submitted",
        "accepted",
        "selected",
        "rejected",
        "next_round",
        "cancelled"
      ],
      default: "awaiting_interviewer_slot",
      index: true
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: ""
    },
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview"
    },
    emailStatus: {
      interviewer: {
        type: String,
        enum: ["pending", "sent", "failed", "skipped"],
        default: "pending"
      },
      candidate: {
        type: String,
        enum: ["pending", "sent", "failed", "skipped"],
        default: "pending"
      },
      error: {
        type: String,
        default: ""
      },
      lastAttemptAt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

interviewRequestSchema.index({ recruiterId: 1, status: 1, createdAt: -1 });
interviewRequestSchema.index({ interviewerId: 1, status: 1, createdAt: -1 });
interviewRequestSchema.index({ candidateId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("InterviewRequest", interviewRequestSchema);
