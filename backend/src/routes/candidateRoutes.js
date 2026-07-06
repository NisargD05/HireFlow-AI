const express = require("express");
const {
  deleteCandidate,
  getCandidates,
  getShortlistedCandidates,
  rankAllCandidates,
  rankCandidate,
  resetCandidates,
  shortlistCandidate
} = require("../controllers/candidateController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("admin"));

router.get("/", getCandidates);
router.get("/shortlisted", getShortlistedCandidates);
router.post("/rank-all", rankAllCandidates);
router.post("/reset", authorizeRoles("admin"), resetCandidates);
router.delete("/", authorizeRoles("admin"), resetCandidates);
router.post("/:id/rank", rankCandidate);
router.put("/:id/shortlist", shortlistCandidate);
router.delete("/:id", deleteCandidate);

module.exports = router;
