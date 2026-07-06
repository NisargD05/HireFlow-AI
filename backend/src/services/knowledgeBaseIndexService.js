const KnowledgeBaseChunk = require("../models/KnowledgeBaseChunk");
const { extractPdfText, chunkText } = require("./pdfTextService");

const indexKnowledgeBaseDocument = async (document) => {
  await KnowledgeBaseChunk.deleteMany({ document: document._id });

  const text = await extractPdfText(document.filePath);
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    return [];
  }

  return KnowledgeBaseChunk.insertMany(
    chunks.map((chunk, index) => ({
      document: document._id,
      text: chunk,
      chunkIndex: index,
      sourceFileName: document.originalFileName
    }))
  );
};

module.exports = {
  indexKnowledgeBaseDocument
};
