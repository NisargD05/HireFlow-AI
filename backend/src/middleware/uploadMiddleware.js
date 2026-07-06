const fs = require("fs");
const path = require("path");
const multer = require("multer");

const ensureUploadDir = (folderName) => {
  const uploadDir = path.join(__dirname, "../../uploads", folderName);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return uploadDir;
};

const createPdfUploader = (folderName) => {
  const uploadDir = ensureUploadDir(folderName);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    }
  });

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024
    }
  });
};

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Only PDF files are allowed"));
  }

  cb(null, true);
};

const uploadPdf = createPdfUploader("knowledge-base");
uploadPdf.resume = createPdfUploader("resumes");
uploadPdf.createPdfUploader = createPdfUploader;

module.exports = uploadPdf;
