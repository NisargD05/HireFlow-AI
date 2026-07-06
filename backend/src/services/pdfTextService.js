const fs = require("fs");
const pdfParse = require("pdf-parse");

const extractPdfText = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text || "";
};

const chunkText = (text, chunkSize = 1200) => {
  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return [];
  }

  const chunks = [];
  for (let index = 0; index < normalizedText.length; index += chunkSize) {
    chunks.push(normalizedText.slice(index, index + chunkSize));
  }

  return chunks;
};

module.exports = {
  extractPdfText,
  chunkText
};
