const express = require("express");
const {
  generateInterviewPacket,
  getInterviewPacket,
  regenerateInterviewPacket
} = require("../controllers/interviewAgentController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);

router.post("/generate/:candidateId", authorizeRoles("admin", "interviewer"), generateInterviewPacket);
router.get("/:interviewId", authorizeRoles("admin", "interviewer"), getInterviewPacket);
router.post("/regenerate/:interviewId", authorizeRoles("admin", "interviewer"), regenerateInterviewPacket);

module.exports = router;
