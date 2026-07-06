const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, trim: true, default: "" },
    whyAsk: { type: String, trim: true, default: "" },
    strongSignal: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const interviewQuestionPacketSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true
    },
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      default: null,
      index: true
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    status: {
      type: String,
      enum: ["generated", "failed"],
      default: "generated",
      index: true
    },
    focusAreas: [String],
    technicalQuestions: [questionSchema],
    followUpQuestions: [questionSchema],
    weaknessProbes: [questionSchema],
    behavioralQuestions: [questionSchema],
    systemDesignQuestions: [questionSchema],
    evaluationChecklist: [String],
    interviewerNotes: [String],
    generationState: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    rawModelOutput: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    error: {
      type: String,
      default: ""
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

interviewQuestionPacketSchema.index({ interviewId: 1, generatedAt: -1 });
interviewQuestionPacketSchema.index({ candidateId: 1, generatedAt: -1 });

module.exports = mongoose.model("InterviewQuestionPacket", interviewQuestionPacketSchema);
