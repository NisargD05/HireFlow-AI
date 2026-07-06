const Candidate = require("../models/Candidate");
const CandidateEvaluation = require("../models/CandidateEvaluation");
const CandidateResume = require("../models/CandidateResume");
const Interview = require("../models/Interview");
const InterviewFeedback = require("../models/InterviewFeedback");
const InterviewRequest = require("../models/InterviewRequest");
const Job = require("../models/Job");
const { parseCandidateResume, rankCandidate: requestCandidateRanking } = require("../services/aiServiceClient");
const logger = require("../utils/logger");
const fs = require("fs/promises");
const path = require("path");

const resumeUploadRoot = path.resolve(__dirname, "../../uploads/resumes");

const populateCandidateQuery = (query) =>
  query
    .populate("job", "roleName department skills seniorityLevel mandatoryRequirements experienceRequired status")
    .populate("shortlistedBy", "name email role")
    .populate("resumeDocument")
    .populate("latestEvaluation");

const ensureApprovedJob = async (jobId) => {
  const job = await Job.findById(jobId);

  if (!job) {
    const error = new Error("Selected job was not found");
    error.status = 404;
    throw error;
  }

  if (job.status !== "approved") {
    const error = new Error("Candidates can only be ranked against approved jobs");
    error.status = 400;
    throw error;
  }

  logger.info("[JD Fetcher] Job found", {
    jobId: job._id.toString(),
    roleName: job.roleName,
    requiredSkillsCount: String(job.skills || "")
      .split(/[,;\n]+/)
      .map((skill) => skill.trim())
      .filter(Boolean).length,
    mandatoryRequirementsCount: String(job.mandatoryRequirements || "")
      .split(/[,;\n]+/)
      .map((requirement) => requirement.trim())
      .filter(Boolean).length,
    approvedJdLength: (job.approvedJD || "").length
  });

  return job;
};

const formatJobPayload = (job) => ({
  _id: job._id.toString(),
  roleName: job.roleName,
  department: job.department,
  requiredSkills: job.skills,
  mandatoryRequirements: job.mandatoryRequirements,
  seniorityLevel: job.seniorityLevel,
  experienceRequired: job.experienceRequired,
  fullJDText: job.approvedJD || job.generatedJD || ""
});

const getResumeText = (resumeDocument) => String(resumeDocument?.resumeText || "").trim();

const getRankingEligibility = (candidate) => {
  const resumeText = getResumeText(candidate.resumeDocument);

  if (!candidate.resumeDocument) {
    return {
      eligible: false,
      resumeText,
      exclusionReason: "candidate.resumeDocument is missing"
    };
  }

  if (!resumeText) {
    return {
      eligible: false,
      resumeText,
      exclusionReason: "candidate.resumeDocument.resumeText is empty"
    };
  }

  return {
    eligible: true,
    resumeText,
    exclusionReason: ""
  };
};

const deleteResumeFile = async (filePath) => {
  if (!filePath) {
    return false;
  }

  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(resumeUploadRoot + path.sep) && resolvedPath !== resumeUploadRoot) {
    logger.warn("[Cleanup] Skipping resume file outside upload directory", {
      filePath,
      resolvedPath,
      resumeUploadRoot
    });
    return false;
  }

  try {
    await fs.unlink(resolvedPath);
    logger.info("[Cleanup] Old resume file removed", { filePath: resolvedPath });
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      logger.info("[Cleanup] Resume file already absent", { filePath: resolvedPath });
      return false;
    }

    throw error;
  }
};

const cleanupCandidateArtifacts = async (candidateIds) => {
  const ids = candidateIds.map((id) => id.toString());
  const resumes = await CandidateResume.find({ candidate: { $in: ids } });
  let filesRemoved = 0;

  for (const resume of resumes) {
    if (await deleteResumeFile(resume.filePath)) {
      filesRemoved += 1;
    }
  }

  const interviews = await Interview.find({ candidateId: { $in: ids } }).select("_id");
  const interviewIds = interviews.map((interview) => interview._id);
  const [
    feedbackResult,
    interviewResult,
    requestResult,
    evaluationResult,
    resumeResult
  ] = await Promise.all([
    InterviewFeedback.deleteMany({ candidateId: { $in: ids } }),
    Interview.deleteMany({ candidateId: { $in: ids } }),
    InterviewRequest.deleteMany({ candidateId: { $in: ids } }),
    CandidateEvaluation.deleteMany({ candidate: { $in: ids } }),
    CandidateResume.deleteMany({ candidate: { $in: ids } })
  ]);

  logger.info("[Cleanup] Candidate artifacts removed", {
    candidateCount: ids.length,
    filesRemoved,
    resumesDeleted: resumeResult.deletedCount,
    evaluationsDeleted: evaluationResult.deletedCount,
    interviewRequestsDeleted: requestResult.deletedCount,
    interviewsDeleted: interviewResult.deletedCount,
    feedbackDeleted: feedbackResult.deletedCount,
    interviewIds: interviewIds.map((id) => id.toString())
  });

  return {
    filesRemoved,
    resumesDeleted: resumeResult.deletedCount,
    evaluationsDeleted: evaluationResult.deletedCount,
    interviewRequestsDeleted: requestResult.deletedCount,
    interviewsDeleted: interviewResult.deletedCount,
    feedbackDeleted: feedbackResult.deletedCount
  };
};

const processCandidateResume = async ({ candidate, file }) => {
  await ensureApprovedJob(candidate.job);

  logger.info("[Resume Parsing] Triggered", {
    candidateId: candidate._id.toString(),
    originalFileName: file.originalname
  });

  candidate.rankingStatus = "parsing";
  candidate.rankingError = "";
  await candidate.save();

  const parsed = await parseCandidateResume({
    filePath: file.path,
    originalFileName: file.originalname
  });

  if (!parsed.resumeText || parsed.resumeText.trim().length < 50) {
    const error = new Error("Resume parsing returned too little text to index reliably");
    error.status = 422;
    error.details = {
      resumeTextLength: (parsed.resumeText || "").length,
      extractionEngine: parsed.extractionEngine
    };
    throw error;
  }

  logger.info("[Resume Indexing] extraction completed", {
    candidateId: candidate._id.toString(),
    resumeTextLength: (parsed.resumeText || "").length,
    skillsCount: parsed.parsedSections?.skills?.length || 0,
    projectsCount: parsed.parsedSections?.projects?.length || 0,
    experienceCount: parsed.parsedSections?.experience?.length || 0
  });

  if (candidate.resumeDocument) {
    const previousResume = await CandidateResume.findById(candidate.resumeDocument);
    if (previousResume) {
      await deleteResumeFile(previousResume.filePath);
      await CandidateResume.deleteOne({ _id: previousResume._id });
      await CandidateEvaluation.deleteMany({ candidate: candidate._id });
      logger.info("[Cleanup] Previous resume and ranking state cleared before new upload", {
        candidateId: candidate._id.toString(),
        previousResumeId: previousResume._id.toString()
      });
    }
  }

  const resume = await CandidateResume.create({
    candidate: candidate._id,
    job: candidate.job,
    originalFileName: file.originalname,
    storedFileName: file.filename,
    filePath: file.path,
    mimeType: file.mimetype || "application/pdf",
    size: file.size || 0,
    resumeText: parsed.resumeText || "",
    parsedSections: parsed.parsedSections || {},
    parserMetadata: {
      characterCount: parsed.characterCount || 0,
      extractionEngine: parsed.extractionEngine || "pdfplumber/pypdf",
      parsedAt: new Date()
    }
  });

  candidate.resumeDocument = resume._id;
  candidate.rankingStatus = "ready";
  candidate.latestEvaluation = null;
  await candidate.save();

  logger.info("[Resume Indexing] candidate resume indexed", {
    candidateId: candidate._id.toString(),
    resumeId: resume._id.toString(),
    resumeTextLength: resume.resumeText.length,
    status: candidate.rankingStatus
  });

  return resume;
};

const saveEvaluation = async ({ candidate, job, ranking }) => {
  logger.info("[MongoDB] Saving ranking", {
    candidateId: candidate._id.toString(),
    jobId: job._id.toString(),
    score: ranking.score,
    recommendation: ranking.recommendation
  });

  const evaluation = await CandidateEvaluation.create({
    candidate: candidate._id,
    job: job._id,
    score: Number(ranking.score) || 0,
    matchesWithJD: ranking.matchesWithJD || [],
    missingWithJD: ranking.missingWithJD || [],
    missingLinks: ranking.missingLinks || [],
    strengths: ranking.strengths || [],
    weaknesses: ranking.weaknesses || [],
    recommendation: ranking.recommendation || "Review",
    rankingReason: ranking.rankingReason || "",
    companyContext: ranking.companyContext || [],
    rawModelOutput: ranking.rawModelOutput || ranking
  });

  candidate.latestEvaluation = evaluation._id;
  candidate.rankingStatus = "ranked";
  candidate.rankingError = "";
  await candidate.save();

  logger.info("[Candidate Ranking] evaluation saved", {
    candidateId: candidate._id.toString(),
    evaluationId: evaluation._id.toString(),
    score: evaluation.score,
    recommendation: evaluation.recommendation
  });
  logger.info("[MongoDB] Ranking saved for candidate", {
    candidateId: candidate._id.toString(),
    evaluationId: evaluation._id.toString()
  });

  return evaluation;
};

const rankSingleCandidate = async (candidateId) => {
  const candidate = await Candidate.findById(candidateId).populate("resumeDocument");

  if (!candidate) {
    const error = new Error("Candidate not found");
    error.status = 404;
    throw error;
  }

  const eligibility = getRankingEligibility(candidate);

  if (!eligibility.eligible) {
    const error = new Error("Upload and parse a resume before ranking this candidate");
    error.status = 400;
    error.exclusionReason = eligibility.exclusionReason;
    throw error;
  }

  const job = await ensureApprovedJob(candidate.job);
  candidate.rankingStatus = "ranking";
  candidate.rankingError = "";
  candidate.latestEvaluation = null;
  await candidate.save();

  const ranking = await requestCandidateRanking({
    candidate: {
      _id: candidate._id.toString(),
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      currentCompany: candidate.currentCompany,
      yearsOfExperience: candidate.yearsOfExperience,
      source: candidate.source,
      notes: candidate.notes
    },
    resume: {
      resumeText: eligibility.resumeText,
      parsedSections: candidate.resumeDocument.parsedSections || {}
    },
    job: formatJobPayload(job)
  });

  logger.info("[Candidate Ranking] AI service returned ranking", {
    candidateId: candidate._id.toString(),
    jobId: job._id.toString(),
    score: ranking.score,
    recommendation: ranking.recommendation,
    matchesCount: ranking.matchesWithJD?.length || 0,
    missingCount: ranking.missingWithJD?.length || 0,
    strengthsCount: ranking.strengths?.length || 0,
    weaknessesCount: ranking.weaknesses?.length || 0
  });

  await saveEvaluation({ candidate, job, ranking });
  return populateCandidateQuery(Candidate.findById(candidate._id));
};

const importExternalCandidateSubmission = async ({ submission, file }) => {
  const duplicate = await Candidate.findOne({
    email: submission.email,
    job: submission.jobId
  });

  if (duplicate) {
    return {
      status: "duplicate",
      candidate: await populateCandidateQuery(Candidate.findById(duplicate._id))
    };
  }

  const parsedExperience = Number.parseFloat(String(submission.experience || "").replace(/[^0-9.]/g, ""));

  const candidate = await Candidate.create({
    name: submission.candidateName,
    email: submission.email,
    phone: submission.phone || "Not provided",
    job: submission.jobId,
    currentCompany: submission.currentCompany || "",
    yearsOfExperience: Number.isFinite(parsedExperience) ? parsedExperience : null,
    source: submission.source || "External application",
    notes: [
      submission.linkedinUrl ? `LinkedIn: ${submission.linkedinUrl}` : "",
      submission.githubUrl ? `GitHub: ${submission.githubUrl}` : "",
      submission.portfolioUrl ? `Portfolio: ${submission.portfolioUrl}` : ""
    ].filter(Boolean).join("\n")
  });

  logger.info("[Candidate Import] Candidate created", {
    candidateId: candidate._id.toString(),
    submissionId: submission._id.toString(),
    jobId: submission.jobId.toString()
  });

  await processCandidateResume({ candidate, file });

  logger.info("[Gemini Ranking] Triggered", {
    candidateId: candidate._id.toString(),
    submissionId: submission._id.toString()
  });

  try {
    const rankedCandidate = await rankSingleCandidate(candidate._id);

    return {
      status: "imported",
      candidate: rankedCandidate
    };
  } catch (error) {
    await Candidate.findByIdAndUpdate(candidate._id, {
      rankingStatus: "failed",
      rankingError: error.message,
      latestEvaluation: null
    });

    logger.error("[Gemini Ranking] Failed after external resume import", {
      candidateId: candidate._id.toString(),
      submissionId: submission._id.toString(),
      error: error.message
    });

    return {
      status: "imported",
      rankingError: error.message,
      candidate: await populateCandidateQuery(Candidate.findById(candidate._id))
    };
  }
};

const rankCandidate = async (req, res) => {
  try {
    const candidate = await rankSingleCandidate(req.params.id);
    res.json({ message: "Candidate ranked", candidate });
  } catch (error) {
    await Candidate.findByIdAndUpdate(req.params.id, {
      rankingStatus: "failed",
      rankingError: error.message,
      latestEvaluation: null
    });
    res.status(error.status || 500).json({ message: error.message || "Failed to rank candidate" });
  }
};

const rankAllCandidates = async (req, res) => {
  try {
    const { jobId } = req.body;
    logger.info("[Backend] Ranking request received", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      jobId
    });

    if (!jobId) {
      return res.status(400).json({ message: "jobId is required" });
    }

    await ensureApprovedJob(jobId);
    logger.info("[Backend] Job ID validated", { jobId });
    logger.info("[Backend] Approved JD fetched", { jobId });

    const candidates = await Candidate.find({ job: jobId }).populate("resumeDocument");
    logger.info("[Ranking] Candidates fetched: %s", candidates.length);
    logger.info("[Ranking] Candidate IDs: %j", candidates.map((candidate) => candidate._id.toString()));

    const eligibleCandidates = [];

    for (const candidate of candidates) {
      const eligibility = getRankingEligibility(candidate);
      logger.info("[Ranking] Checking candidate: %s", candidate.name);
      logger.info("[Ranking] Resume text exists: %s", Boolean(eligibility.resumeText));
      logger.info("[Ranking] Resume text length: %s", eligibility.resumeText.length);
      logger.info("[Ranking] Candidate status: %s", candidate.status);
      logger.info("[Ranking] Candidate jobId: %s", candidate.job?.toString());
      logger.info("[Ranking] Candidate eligible: %s", eligibility.eligible);

      if (!eligibility.eligible) {
        logger.info("[Ranking] Exclusion reason: %s", eligibility.exclusionReason);
        continue;
      }

      eligibleCandidates.push(candidate);
    }

    const rankedCandidates = [];
    const failures = [];

    for (const candidate of eligibleCandidates) {
      try {
        logger.info("[Backend] Calling AI service", {
          candidateId: candidate._id.toString(),
          jobId
        });
        rankedCandidates.push(await rankSingleCandidate(candidate._id));
        logger.info("[Backend] AI response received", {
          candidateId: candidate._id.toString()
        });
      } catch (error) {
        failures.push({ candidateId: candidate._id.toString(), message: error.message });
        await Candidate.findByIdAndUpdate(candidate._id, {
          rankingStatus: "failed",
          rankingError: error.message,
          latestEvaluation: null
        });
      }
    }

    logger.info("[Backend] Rankings saved successfully", {
      jobId,
      rankedCount: rankedCandidates.length,
      failedCount: failures.length,
      eligibleCount: eligibleCandidates.length,
      fetchedCount: candidates.length
    });

    res.json({
      message: "Candidate ranking completed",
      rankedCount: rankedCandidates.length,
      failedCount: failures.length,
      failures,
      candidates: rankedCandidates
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || "Failed to rank candidates" });
  }
};

const getCandidates = async (req, res) => {
  try {
    const filter = {};
    const sort = {};

    if (req.query.jobId) {
      filter.job = req.query.jobId;
    }

    if (req.query.status === "shortlisted") {
      filter.isShortlisted = true;
    } else if (req.query.status) {
      filter.status = req.query.status;
    }

    let candidates = await populateCandidateQuery(Candidate.find(filter).sort({ createdAt: -1 }));

    if (req.query.sort === "score") {
      candidates = candidates.sort((a, b) => {
        return (b.latestEvaluation?.score || -1) - (a.latestEvaluation?.score || -1);
      });
    } else if (sort.createdAt) {
      candidates = candidates.sort(sort);
    }

    logger.info("[Candidate List] candidates fetched", {
      jobId: req.query.jobId || null,
      status: req.query.status || null,
      count: candidates.length
    });

    res.json({ candidates });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch candidates", error: error.message });
  }
};

const getShortlistedCandidates = async (req, res) => {
  try {
    const filter = {
      isShortlisted: true
    };

    if (req.query.jobId) {
      filter.job = req.query.jobId;
    }

    const candidates = await populateCandidateQuery(
      Candidate.find(filter).sort({ shortlistedAt: -1, updatedAt: -1 })
    );

    logger.info("[Shortlist] candidates fetched", {
      jobId: req.query.jobId || null,
      count: candidates.length,
      candidateIds: candidates.map((candidate) => candidate._id.toString())
    });

    res.json({
      candidates,
      count: candidates.length
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch shortlisted candidates",
      error: error.message
    });
  }
};

const shortlistCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const finalizedInterview = await Interview.findOne({
      candidateId: candidate._id,
      recruiterDecision: { $in: ["accepted", "rejected"] }
    }).select("_id recruiterDecision");

    if (finalizedInterview) {
      return res.status(409).json({
        message: "Candidate has a finalized hiring decision and cannot be changed from the shortlist view"
      });
    }

    if (req.body.status === "rejected") {
      candidate.status = "rejected";
      candidate.isShortlisted = false;
      candidate.shortlistedAt = null;
      candidate.shortlistedBy = null;
    } else {
      candidate.status = "shortlisted";
      candidate.isShortlisted = true;
      candidate.shortlistedAt = candidate.shortlistedAt || new Date();
      candidate.shortlistedBy = candidate.shortlistedBy || req.user._id;
    }

    await candidate.save();

    const hydrated = await populateCandidateQuery(Candidate.findById(candidate._id));

    logger.info("[Shortlist] candidate status updated", {
      candidateId: candidate._id.toString(),
      status: candidate.status,
      isShortlisted: candidate.isShortlisted,
      shortlistedBy: candidate.shortlistedBy?.toString() || null
    });

    res.json({ message: "Candidate status updated", candidate: hydrated });
  } catch (error) {
    res.status(500).json({ message: "Failed to update candidate", error: error.message });
  }
};

const deleteCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const cleanup = await cleanupCandidateArtifacts([candidate._id]);
    await Candidate.deleteOne({ _id: candidate._id });

    logger.info("[Cleanup] Old candidate record deleted", {
      candidateId: candidate._id.toString(),
      email: candidate.email,
      cleanup
    });

    res.json({
      message: "Candidate and related resume/ranking/interview data deleted",
      deletedCount: 1,
      cleanup
    });
  } catch (error) {
    logger.error("[Cleanup] Candidate delete failed", {
      candidateId: req.params.id,
      error: error.message
    });
    res.status(500).json({ message: "Failed to delete candidate", error: error.message });
  }
};

const resetCandidates = async (req, res) => {
  try {
    const filter = {};
    if (req.query.jobId || req.body?.jobId) {
      filter.job = req.query.jobId || req.body.jobId;
    }

    const candidates = await Candidate.find(filter).select("_id email job");
    const candidateIds = candidates.map((candidate) => candidate._id);

    if (candidateIds.length === 0) {
      return res.json({
        message: "No candidates matched the cleanup filter",
        deletedCount: 0,
        cleanup: {
          filesRemoved: 0,
          resumesDeleted: 0,
          evaluationsDeleted: 0,
          interviewRequestsDeleted: 0,
          interviewsDeleted: 0,
          feedbackDeleted: 0
        }
      });
    }

    const cleanup = await cleanupCandidateArtifacts(candidateIds);
    const candidateResult = await Candidate.deleteMany({ _id: { $in: candidateIds } });

    logger.info("[Cleanup] Old candidate records deleted", {
      deletedCount: candidateResult.deletedCount,
      jobId: filter.job || null,
      cleanup
    });

    res.json({
      message: "Candidate cleanup completed",
      deletedCount: candidateResult.deletedCount,
      cleanup
    });
  } catch (error) {
    logger.error("[Cleanup] Candidate reset failed", {
      jobId: req.query.jobId || req.body?.jobId || null,
      error: error.message
    });
    res.status(500).json({ message: "Failed to reset candidate data", error: error.message });
  }
};

module.exports = {
  deleteCandidate,
  rankCandidate,
  rankAllCandidates,
  resetCandidates,
  getCandidates,
  getShortlistedCandidates,
  shortlistCandidate,
  importExternalCandidateSubmission
};
