const dotenv = require("dotenv");
const fs = require("fs/promises");
const mongoose = require("mongoose");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const Candidate = require("../src/models/Candidate");
const CandidateEvaluation = require("../src/models/CandidateEvaluation");
const CandidateResume = require("../src/models/CandidateResume");
const Interview = require("../src/models/Interview");
const InterviewFeedback = require("../src/models/InterviewFeedback");
const InterviewRequest = require("../src/models/InterviewRequest");

const resumeUploadRoot = path.resolve(__dirname, "../uploads/resumes");

const deleteResumeFile = async (filePath) => {
  if (!filePath) {
    return false;
  }

  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(resumeUploadRoot + path.sep)) {
    console.warn("[Cleanup] Skipped file outside resume upload directory:", resolvedPath);
    return false;
  }

  try {
    await fs.unlink(resolvedPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const jobId = process.argv.find((arg) => arg.startsWith("--jobId="))?.split("=")[1];
  const candidateFilter = jobId ? { job: jobId } : {};
  const candidates = await Candidate.find(candidateFilter).select("_id");
  const candidateIds = candidates.map((candidate) => candidate._id);
  const resumes = await CandidateResume.find({ candidate: { $in: candidateIds } });

  let filesRemoved = 0;
  for (const resume of resumes) {
    if (await deleteResumeFile(resume.filePath)) {
      filesRemoved += 1;
    }
  }

  const feedback = await InterviewFeedback.deleteMany({ candidateId: { $in: candidateIds } });
  const interviews = await Interview.deleteMany({ candidateId: { $in: candidateIds } });
  const requests = await InterviewRequest.deleteMany({ candidateId: { $in: candidateIds } });
  const evaluations = await CandidateEvaluation.deleteMany({ candidate: { $in: candidateIds } });
  const resumeDocs = await CandidateResume.deleteMany({ candidate: { $in: candidateIds } });
  const candidateDocs = await Candidate.deleteMany({ _id: { $in: candidateIds } });

  console.log(
    JSON.stringify(
      {
        jobId: jobId || null,
        candidatesDeleted: candidateDocs.deletedCount,
        resumesDeleted: resumeDocs.deletedCount,
        evaluationsDeleted: evaluations.deletedCount,
        interviewRequestsDeleted: requests.deletedCount,
        interviewsDeleted: interviews.deletedCount,
        feedbackDeleted: feedback.deletedCount,
        filesRemoved
      },
      null,
      2
    )
  );
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
