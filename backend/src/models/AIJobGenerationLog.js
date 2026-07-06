const mongoose = require("mongoose");

const aiJobGenerationLogSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    promptSummary: {
      type: String,
      default: ""
    },
    sourceCount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success"
    },
    errorMessage: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("AIJobGenerationLog", aiJobGenerationLogSchema);
