const mongoose = require("mongoose");

const technicalRatingsSchema = new mongoose.Schema(
  {
    problemSolving: { type: Number, min: 1, max: 10, required: true },
    backendFundamentals: { type: Number, min: 1, max: 10, required: true },
    systemDesign: { type: Number, min: 1, max: 10, required: true },
    databases: { type: Number, min: 1, max: 10, required: true },
    debugging: { type: Number, min: 1, max: 10, required: true },
    communication: { type: Number, min: 1, max: 10, required: true },
    productionReadiness: { type: Number, min: 1, max: 10, required: true }
  },
  { _id: false }
);

const interviewFeedbackSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
      unique: true,
      index: true
    },
    interviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true
    },
    technicalRating: {
      type: Number,
      min: 1,
      max: 5
    },
    communicationRating: {
      type: Number,
      min: 1,
      max: 5
    },
    problemSolvingRating: {
      type: Number,
      min: 1,
      max: 5
    },
    cultureFitRating: {
      type: Number,
      min: 1,
      max: 5
    },
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
      enum: ["Strong Hire", "Hire", "Borderline", "Reject", "selected", "rejected", "next_round"],
      required: true,
      index: true
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("InterviewFeedback", interviewFeedbackSchema);
