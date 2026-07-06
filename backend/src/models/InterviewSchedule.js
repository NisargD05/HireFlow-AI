const mongoose = require("mongoose");

const interviewScheduleSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewAssignment",
      required: true
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true
    },
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    startsAt: {
      type: Date,
      required: true
    },
    endsAt: {
      type: Date,
      required: true
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata"
    },
    meetingLink: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "completed"],
      default: "scheduled"
    },
    emailStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "sent"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("InterviewSchedule", interviewScheduleSchema);
