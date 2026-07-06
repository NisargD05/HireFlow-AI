const mongoose = require("mongoose");

const candidateResumeSchema = new mongoose.Schema(
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
    originalFileName: {
      type: String,
      required: true
    },
    storedFileName: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      default: "application/pdf"
    },
    size: {
      type: Number,
      default: 0
    },
    resumeText: {
      type: String,
      default: ""
    },
    parsedSections: {
      skills: [String],
      experience: [
        {
          role: String,
          company: String,
          duration: String,
          highlights: [String]
        }
      ],
      projects: [String],
      education: String,
      certifications: [String]
    },
    parserMetadata: {
      characterCount: Number,
      extractionEngine: String,
      parsedAt: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("CandidateResume", candidateResumeSchema);
