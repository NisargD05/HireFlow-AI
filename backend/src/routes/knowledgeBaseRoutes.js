const express = require("express");
const {
  uploadDocument,
  getDocuments,
  deleteDocument
} = require("../controllers/knowledgeBaseController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const uploadPdf = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("admin"));

router.post("/upload", uploadPdf.single("file"), uploadDocument);
router.get("/", getDocuments);
router.delete("/:id", deleteDocument);

module.exports = router;
