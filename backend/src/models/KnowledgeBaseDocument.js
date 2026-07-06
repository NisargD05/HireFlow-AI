const mongoose = require("mongoose");

const knowledgeBaseDocumentSchema = new mongoose.Schema(
  {
    originalFileName: {
      type: String,
      required: true,
      trim: true
    },
    storedFileName: {
      type: String,
      required: true,
      trim: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    filePath: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["uploaded", "indexing", "indexed", "failed"],
      default: "uploaded"
    },
    indexingError: {
      type: String,
      default: ""
    },
    chunkCount: {
      type: Number,
      default: 0
    },
    chromaCollectionName: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("KnowledgeBaseDocument", knowledgeBaseDocumentSchema);
