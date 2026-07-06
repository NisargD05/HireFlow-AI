const mongoose = require("mongoose");

const interviewAssignmentSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
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
    questionnaire: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Questionnaire"
    },
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewSchedule"
    },
    interviewDate: {
      type: Date,
      required: true
    },
    workingHours: {
      start: {
        type: String,
        default: "09:00"
      },
      end: {
        type: String,
        default: "18:00"
      },
      timezone: {
        type: String,
        default: "Asia/Kolkata"
      },
      durationMinutes: {
        type: Number,
        default: 60
      }
    },
    selectedTime: String,
    status: {
      type: String,
      enum: ["assigned", "slot_selected", "scheduled", "completed", "cancelled"],
      default: "assigned"
    },
    recruiterNotes: String,
    invitedAt: Date
  },
  {
    timestamps: true
  }
);

interviewAssignmentSchema.index({ interviewer: 1, status: 1 });

module.exports = mongoose.model("InterviewAssignment", interviewAssignmentSchema);
