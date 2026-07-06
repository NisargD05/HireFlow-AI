const mongoose = require("mongoose");

const technicalRatingsSchema = new mongoose.Schema(
  {
    problemSolving: { type: Number, min: 1, max: 10 },
    backendFundamentals: { type: Number, min: 1, max: 10 },
    systemDesign: { type: Number, min: 1, max: 10 },
    databases: { type: Number, min: 1, max: 10 },
    debugging: { type: Number, min: 1, max: 10 },
    communication: { type: Number, min: 1, max: 10 },
    productionReadiness: { type: Number, min: 1, max: 10 }
  },
  { _id: false }
);

const interviewerFeedbackSchema = new mongoose.Schema(
  {
    technicalRatings: {
      type: technicalRatingsSchema,
      default: null
    },
    strengths: {
      type: String,
      trim: true,
      default: ""
    },
    concerns: {
      type: String,
      trim: true,
      default: ""
    },
    observations: {
      type: String,
      trim: true,
      default: ""
    },
    finalNotes: {
      type: String,
      trim: true,
      default: ""
    },
    recommendation: {
      type: String,
      enum: ["Strong Hire", "Hire", "Borderline", "Reject"],
      default: undefined
    }
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewRequest",
      required: true,
      unique: true,
      index: true
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true
    },
    candidateName: {
      type: String,
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
      lowercase: true,
      trim: true
    },
    candidateEmail: {
      type: String,
      lowercase: true,
      trim: true
    },
    preferredWindow: {
      startDate: Date,
      endDate: Date
    },
    selectedDate: {
      type: String,
      trim: true
    },
    selectedTime: {
      type: String,
      trim: true
    },
    meetingLink: {
      type: String,
      required: true,
      unique: true
    },
    meetingRoomId: {
      type: String,
      required: true,
      unique: true
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    roundType: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "feedback_submitted", "accepted", "selected", "rejected", "next_round", "cancelled"],
      default: "scheduled",
      index: true
    },
    interviewStatus: {
      type: String,
      enum: ["scheduled", "completed", "feedback_submitted", "accepted", "selected", "rejected", "next_round", "cancelled"],
      default: "scheduled"
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
    },
    feedbackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewFeedback"
    },
    interviewerFeedback: {
      type: interviewerFeedbackSchema,
      default: null
    },
    interviewerRecommendation: {
      type: String,
      enum: ["Strong Hire", "Hire", "Borderline", "Reject"],
      default: undefined,
      index: true
    },
    recruiterDecision: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true
    },
    decisionAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

interviewSchema.index({ interviewerId: 1, scheduledAt: 1 });
interviewSchema.index({ recruiterId: 1, scheduledAt: -1 });

interviewSchema.pre("validate", function preventPastInterview(next) {
  if (this.isNew && this.scheduledAt && this.scheduledAt <= new Date()) {
    this.invalidate("scheduledAt", "Interview must be scheduled for a future time");
  }

  next();
});

module.exports = mongoose.model("Interview", interviewSchema);
