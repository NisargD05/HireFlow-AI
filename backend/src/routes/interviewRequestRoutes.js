const express = require("express");
const {
  acceptInterviewRequest,
  createInterviewRequest,
  getInterviewerRequests,
  getRecruiterInterviewRequests,
  rejectInterviewRequest,
  resendInterviewEmails
} = require("../controllers/interviewRequestController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);

router.post("/", authorizeRoles("admin"), createInterviewRequest);
router.get("/recruiter", authorizeRoles("admin"), getRecruiterInterviewRequests);
router.get("/interviewer", authorizeRoles("interviewer"), getInterviewerRequests);
router.post("/:id/accept", authorizeRoles("interviewer"), acceptInterviewRequest);
router.post("/:id/reject", authorizeRoles("interviewer"), rejectInterviewRequest);
router.post("/:id/resend-email", authorizeRoles("interviewer"), resendInterviewEmails);

module.exports = router;
