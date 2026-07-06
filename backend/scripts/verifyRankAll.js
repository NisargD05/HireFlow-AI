const axios = require("axios");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const Job = require("../src/models/Job");
const User = require("../src/models/User");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ role: { $in: ["admin", "recruiter"] } }).select("_id role email");
  const job = await Job.findOne({ status: "approved" }).sort({ createdAt: -1 }).select("_id roleName");

  if (!user || !job) {
    throw new Error("Need one recruiter/admin user and one approved job to verify ranking");
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "10m" });
  const { data } = await axios.post(
    "http://localhost:5000/api/candidates/rank-all",
    { jobId: job._id.toString() },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 180000
    }
  );

  console.log(
    JSON.stringify(
      {
        user: user.email,
        job: job.roleName,
        rankedCount: data.rankedCount,
        failedCount: data.failedCount,
        failures: data.failures,
        candidateScores: (data.candidates || []).map((candidate) => ({
          name: candidate.name,
          score: candidate.latestEvaluation?.score,
          recommendation: candidate.latestEvaluation?.recommendation,
          rankingStatus: candidate.rankingStatus
        }))
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    console.error(JSON.stringify(error.response?.data || { message: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
