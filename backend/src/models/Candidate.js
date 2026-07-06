const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    location: String,
    currentRole: String,
    experienceYears: Number,
    skills: [String],
    education: [
      {
        degree: String,
        institution: String,
        year: String
      }
    ],
    links: [
      {
        label: String,
        url: String
      }
    ],
    currentCompany: {
      type: String,
      trim: true,
      default: ""
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      default: null
    },
    source: {
      type: String,
      trim: true,
      default: "Manual upload"
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    },
    resumeDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CandidateResume"
    },
    resume: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    aiSummary: String,
    match: {
      score: Number,
      matchedSkills: [String],
      missingSkills: [String],
      riskNotes: [String],
      explanation: String
    },
    latestEvaluation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CandidateEvaluation"
    },
    rankingStatus: {
      type: String,
      enum: ["pending", "resume_uploaded", "parsing", "ready", "ranking", "ranked", "failed"],
      default: "pending",
      index: true
    },
    rankingError: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["new", "shortlisted", "assigned", "interview_scheduled", "accepted", "rejected", "review"],
      default: "new",
      index: true
    },
    isShortlisted: {
      type: Boolean,
      default: false,
      index: true
    },
    shortlistedAt: {
      type: Date,
      default: null
    },
    shortlistedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

candidateSchema.index({ email: 1, job: 1 });
candidateSchema.index({ job: 1, status: 1, rankingStatus: 1 });
candidateSchema.index({ job: 1, isShortlisted: 1, shortlistedAt: -1 });

module.exports = mongoose.model("Candidate", candidateSchema);
