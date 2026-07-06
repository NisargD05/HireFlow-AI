const Candidate = require("../models/Candidate");
const Interview = require("../models/Interview");
const InterviewQuestionPacket = require("../models/InterviewQuestionPacket");
const { generateInterviewQuestionPacket } = require("../services/aiServiceClient");
const logger = require("../utils/logger");

const questionPacketPopulate = [
  { path: "candidateId", select: "name email currentCompany yearsOfExperience status" },
  { path: "interviewId", select: "roundType scheduledAt endTime status interviewerId recruiterId" },
  { path: "jobId", select: "roleName department" }
];

const canAccessInterview = (interview, user) => {
  if (!interview || !user) {
    return false;
  }
  if (user.role === "admin") {
    return true;
  }
  if (user.role === "interviewer") {
    return String(interview.interviewerId?._id || interview.interviewerId) === String(user._id);
  }
  return false;
};

const buildCandidatePayload = (candidate) => ({
  _id: candidate._id.toString(),
  name: candidate.name,
  email: candidate.email,
  currentCompany: candidate.currentCompany || "",
  yearsOfExperience: candidate.yearsOfExperience,
  notes: candidate.notes || ""
});

const buildResumePayload = (candidate) => ({
  resumeText: candidate.resumeDocument?.resumeText || "",
  parsedSections: candidate.resumeDocument?.parsedSections || {}
});

const buildRankingPayload = (candidate) => {
  const evaluation = candidate.latestEvaluation;
  return {
    score: evaluation?.score ?? null,
    matchesWithJD: evaluation?.matchesWithJD || [],
    missingWithJD: evaluation?.missingWithJD || [],
    missingLinks: evaluation?.missingLinks || [],
    strengths: evaluation?.strengths || [],
    weaknesses: evaluation?.weaknesses || [],
    recommendation: evaluation?.recommendation || "",
    rankingReason: evaluation?.rankingReason || ""
  };
};

const buildJobPayload = (job) => ({
  _id: job._id.toString(),
  roleName: job.roleName,
  department: job.department || "",
  skills: job.skills || "",
  mandatoryRequirements: job.mandatoryRequirements || "",
  seniorityLevel: job.seniorityLevel || "",
  experienceRequired: job.experienceRequired || "",
  approvedJD: job.approvedJD || job.generatedJD || ""
});

const buildInterviewPayload = (interview) => {
  if (!interview) {
    return {};
  }
  return {
    _id: interview._id.toString(),
    roundType: interview.roundType,
    duration: interview.duration,
    scheduledAt: interview.scheduledAt,
    status: interview.status,
    recruiterNotes: interview.requestId?.notes || ""
  };
};

const normalizePacket = (packet) => ({
  focusAreas: packet.focusAreas || [],
  technicalQuestions: packet.technicalQuestions || [],
  followUpQuestions: packet.followUpQuestions || [],
  weaknessProbes: packet.weaknessProbes || [],
  behavioralQuestions: packet.behavioralQuestions || [],
  systemDesignQuestions: packet.systemDesignQuestions || [],
  evaluationChecklist: packet.evaluationChecklist || [],
  interviewerNotes: packet.interviewerNotes || [],
  rawModelOutput: packet.rawModelOutput || null
});

const getCandidateForGeneration = async (candidateId) => {
  return Candidate.findById(candidateId)
    .populate("job")
    .populate("resumeDocument")
    .populate("latestEvaluation");
};

const generateForCandidate = async ({ candidateId, interviewId, user, force = false }) => {
  if (user?.role === "interviewer" && !interviewId) {
    const error = new Error("interviewId is required for interviewer packet generation");
    error.status = 400;
    throw error;
  }

  const [candidate, interview] = await Promise.all([
    getCandidateForGeneration(candidateId),
    interviewId
      ? Interview.findById(interviewId).populate("requestId", "notes").populate("jobId")
      : null
  ]);

  if (!candidate) {
    const error = new Error("Candidate not found");
    error.status = 404;
    throw error;
  }

  if (!candidate.resumeDocument?.resumeText) {
    const error = new Error("Candidate resume text is required before generating interview questions");
    error.status = 400;
    throw error;
  }

  if (!candidate.latestEvaluation) {
    const error = new Error("Candidate ranking is required before generating interview questions");
    error.status = 400;
    throw error;
  }

  if (interview && !canAccessInterview(interview, user)) {
    const error = new Error("Interview not found");
    error.status = 404;
    throw error;
  }

  if (interview && String(interview.candidateId) !== String(candidate._id)) {
    const error = new Error("Interview does not belong to this candidate");
    error.status = 400;
    throw error;
  }

  if (!force) {
    const existing = await InterviewQuestionPacket.findOne(
      interview ? { interviewId: interview._id } : { candidateId: candidate._id, interviewId: null }
    )
      .sort({ generatedAt: -1 })
      .populate(questionPacketPopulate);

    if (existing) {
      return existing;
    }
  }

  const aiResponse = await generateInterviewQuestionPacket({
    candidate: buildCandidatePayload(candidate),
    resume: buildResumePayload(candidate),
    ranking: buildRankingPayload(candidate),
    job: buildJobPayload(interview?.jobId || candidate.job),
    interview: buildInterviewPayload(interview)
  });

  const packetData = normalizePacket(aiResponse.packet || {});
  const packet = await InterviewQuestionPacket.create({
    candidateId: candidate._id,
    interviewId: interview?._id || null,
    jobId: interview?.jobId?._id || candidate.job?._id || candidate.job,
    generatedBy: user?._id || null,
    status: "generated",
    ...packetData,
    generationState: aiResponse.state || {},
    generatedAt: new Date()
  });

  logger.info("[InterviewQuestionAgent] packet saved", {
    packetId: packet._id.toString(),
    candidateId: candidate._id.toString(),
    interviewId: interview?._id?.toString() || null
  });

  return InterviewQuestionPacket.findById(packet._id).populate(questionPacketPopulate);
};

const generateInterviewPacket = async (req, res) => {
  try {
    const packet = await generateForCandidate({
      candidateId: req.params.candidateId,
      interviewId: req.body?.interviewId || null,
      user: req.user,
      force: Boolean(req.body?.force)
    });

    res.status(201).json({ success: true, packet });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to generate interview packet"
    });
  }
};

const getInterviewPacket = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interviewId);
    if (!interview || !canAccessInterview(interview, req.user)) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    const packet = await InterviewQuestionPacket.findOne({ interviewId: interview._id })
      .sort({ generatedAt: -1 })
      .populate(questionPacketPopulate);

    if (!packet) {
      return res.status(404).json({ success: false, message: "Interview packet not found" });
    }

    res.json({ success: true, packet });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to load interview packet", error: error.message });
  }
};

const regenerateInterviewPacket = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interviewId);
    if (!interview || !canAccessInterview(interview, req.user)) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    const packet = await generateForCandidate({
      candidateId: interview.candidateId,
      interviewId: interview._id,
      user: req.user,
      force: true
    });

    res.status(201).json({ success: true, packet });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to regenerate interview packet"
    });
  }
};

module.exports = {
  generateInterviewPacket,
  getInterviewPacket,
  regenerateInterviewPacket
};
