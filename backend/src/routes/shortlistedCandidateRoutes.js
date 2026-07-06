const express = require("express");
const { getShortlistedCandidates } = require("../controllers/candidateController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("admin"));

router.get("/", getShortlistedCandidates);

module.exports = router;
