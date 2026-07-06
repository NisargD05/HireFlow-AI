const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    roleName: {
      type: String,
      required: true,
      trim: true
    },
    department: {
      type: String,
      trim: true,
      default: ""
    },
    location: {
      type: String,
      trim: true,
      default: ""
    },
    experienceRequired: {
      type: String,
      trim: true,
      default: ""
    },
    salaryRange: {
      type: String,
      trim: true,
      default: ""
    },
    skills: {
      type: String,
      trim: true,
      default: ""
    },
    education: {
      type: String,
      trim: true,
      default: ""
    },
    jobType: {
      type: String,
      trim: true,
      default: ""
    },
    numberOfOpenings: {
      type: Number,
      default: 1,
      min: 1
    },
    seniorityLevel: {
      type: String,
      trim: true,
      default: ""
    },
    mandatoryRequirements: {
      type: String,
      trim: true,
      default: ""
    },
    generatedJD: {
      type: String,
      default: ""
    },
    approvedJD: {
      type: String,
      default: ""
    },
    applicationLink: {
      type: String,
      default: ""
    },
    applicationFormProvider: {
      type: String,
      enum: ["tally", "typeform", ""],
      default: ""
    },
    applicationFormId: {
      type: String,
      default: ""
    },
    applicationLinkGeneratedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ["draft", "generated", "edited", "approved"],
      default: "draft"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    knowledgeBaseSources: [
      {
        document: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "KnowledgeBaseDocument"
        },
        sourceFileName: String,
        chunkText: String,
        score: Number
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Job", jobSchema);
