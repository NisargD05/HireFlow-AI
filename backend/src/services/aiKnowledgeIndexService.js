const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const logger = require("../utils/logger");

const indexPdfWithAiService = async (document) => {
  const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8001";
  const endpoint = `${aiServiceUrl}/knowledge/index-pdf`;

  logger.info("Sending PDF to AI service for indexing", {
    endpoint,
    documentId: document._id.toString(),
    originalFileName: document.originalFileName,
    filePath: document.filePath
  });

  const form = new FormData();
  form.append("file", fs.createReadStream(document.filePath), {
    filename: document.originalFileName,
    contentType: document.mimeType
  });
  form.append("documentId", document._id.toString());
  form.append("sourceFileName", document.originalFileName);

  try {
    const { data } = await axios.post(endpoint, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000
    });

    logger.info("AI service indexing completed", {
      documentId: document._id.toString(),
      chunkCount: data.chunkCount,
      collectionName: data.collectionName
    });

    return data;
  } catch (error) {
    const responseData = error.response?.data;
    const message =
      responseData?.message ||
      responseData?.detail ||
      error.message ||
      "AI service indexing request failed";

    logger.error("AI service indexing failed", {
      documentId: document._id.toString(),
      status: error.response?.status,
      message,
      responseData
    });

    const wrappedError = new Error(message);
    wrappedError.status = error.response?.status || 500;
    wrappedError.details = responseData;
    throw wrappedError;
  }
};

module.exports = {
  indexPdfWithAiService
};
