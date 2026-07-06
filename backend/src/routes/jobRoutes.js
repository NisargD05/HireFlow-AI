const express = require("express");
const {
  createJob,
  generateJD,
  editJD,
  approveJob,
  getJobs,
  getJobById
} = require("../controllers/jobController");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("admin"));

router.post("/create", createJob);
router.post("/generate-jd", generateJD);
router.put("/:id/edit-jd", editJD);
router.post("/:id/approve", approveJob);
router.get("/", getJobs);
router.get("/:id", getJobById);

module.exports = router;
