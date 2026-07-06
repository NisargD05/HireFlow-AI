const mongoose = require("mongoose");

const knowledgeBaseChunkSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeBaseDocument",
      required: true
    },
    text: {
      type: String,
      required: true
    },
    chunkIndex: {
      type: Number,
      required: true
    },
    sourceFileName: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

knowledgeBaseChunkSchema.index({ text: "text" });

module.exports = mongoose.model("KnowledgeBaseChunk", knowledgeBaseChunkSchema);
