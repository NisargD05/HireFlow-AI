const fs = require("fs");
const KnowledgeBaseDocument = require("../models/KnowledgeBaseDocument");
const KnowledgeBaseChunk = require("../models/KnowledgeBaseChunk");
const { indexPdfWithAiService } = require("../services/aiKnowledgeIndexService");
const logger = require("../utils/logger");

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "PDF file is required" });
    }

    logger.info("Knowledge Base upload received", {
      userId: req.user._id.toString(),
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size
    });

    const document = await KnowledgeBaseDocument.create({
      originalFileName: req.file.originalname,
      storedFileName: req.file.filename,
      uploadedBy: req.user._id,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      status: "indexing"
    });

    try {
      const indexResult = await indexPdfWithAiService(document);

      await KnowledgeBaseChunk.deleteMany({ document: document._id });
      await KnowledgeBaseChunk.insertMany(
        indexResult.chunks.map((chunk, index) => ({
          document: document._id,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex ?? index,
          sourceFileName: document.originalFileName
        }))
      );

      document.status = "indexed";
      document.indexingError = "";
      document.chunkCount = indexResult.chunkCount || indexResult.chunks.length;
      document.chromaCollectionName = indexResult.collectionName || "";
      await document.save();
    } catch (error) {
      document.status = "failed";
      document.indexingError = error.message;
      await document.save();

      return res.status(error.status || 500).json({
        success: false,
        message: "PDF uploaded, but knowledge indexing failed",
        error: error.message,
        details: error.details || null,
        document
      });
    }

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      document
    });
  } catch (error) {
    logger.error("Knowledge Base upload failed", {
      error: error.message
    });
    res.status(500).json({ success: false, message: "Upload failed", error: error.message });
  }
};

const getDocuments = async (req, res) => {
  try {
    const documents = await KnowledgeBaseDocument.find()
      .populate("uploadedBy", "name email role")
      .sort({ uploadedAt: -1 });

    res.json({ documents });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch documents", error: error.message });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const document = await KnowledgeBaseDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    await KnowledgeBaseChunk.deleteMany({ document: document._id });
    await document.deleteOne();
    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete document", error: error.message });
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  deleteDocument
};
