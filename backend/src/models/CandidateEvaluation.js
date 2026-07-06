const mongoose = require("mongoose");

const candidateEvaluationSchema = new mongoose.Schema(
  {
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true
    },
    matchesWithJD: [String],
    missingWithJD: [String],
    missingLinks: [String],
    strengths: [String],
    weaknesses: [String],
    recommendation: {
      type: String,
      enum: ["Shortlist", "Review", "Reject"],
      default: "Review",
      index: true
    },
    rankingReason: {
      type: String,
      default: ""
    },
    companyContext: [
      {
        sourceFileName: String,
        chunkText: String,
        score: Number
      }
    ],
    scoringWeights: {
      jdSkillMatch: { type: Number, default: 40 },
      experienceMatch: { type: Number, default: 25 },
      projectRelevance: { type: Number, default: 15 },
      companyKbAlignment: { type: Number, default: 10 },
      mandatoryRequirementFit: { type: Number, default: 10 }
    },
    rawModelOutput: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    evaluatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

candidateEvaluationSchema.index({ job: 1, score: -1 });

module.exports = mongoose.model("CandidateEvaluation", candidateEvaluationSchema);
