const express = require("express");
const {
  fetchResumes,
  getApplicationSummary
} = require("../controllers/externalApplicationController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("admin"));

router.get("/summary", getApplicationSummary);
router.post("/fetch-resumes", fetchResumes);

module.exports = router;
