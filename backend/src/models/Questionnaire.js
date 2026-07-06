const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        "technical",
        "behavioral",
        "scenario",
        "project",
        "coding",
        "system_design"
      ],
      required: true
    },
    prompt: {
      type: String,
      required: true
    },
    difficulty: {
      type: String,
      enum: ["warmup", "core", "deep_dive"],
      default: "core"
    },
    evaluationGuide: String
  },
  { _id: false }
);

const questionnaireSchema = new mongoose.Schema(
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
    generatedBy: {
      type: String,
      default: "ai"
    },
    questions: [questionSchema],
    recruiterNotes: String
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Questionnaire", questionnaireSchema);
