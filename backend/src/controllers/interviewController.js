const Interview = require("../models/Interview");
const InterviewFeedback = require("../models/InterviewFeedback");
const InterviewRequest = require("../models/InterviewRequest");
const InterviewQuestionPacket = require("../models/InterviewQuestionPacket");
const Candidate = require("../models/Candidate");
const { sendAcceptanceEmail, sendRejectionEmail } = require("../services/emailService");
const logger = require("../utils/logger");

const interviewPopulate = [
  {
    path: "candidateId",
    select: "name email phone currentCompany yearsOfExperience skills resume status resumeDocument latestEvaluation notes",
    populate: [
      { path: "resumeDocument", select: "originalFileName resumeText parsedSections filePath" },
      { path: "latestEvaluation" }
    ]
  },
  { path: "jobId", select: "roleName department location skills mandatoryRequirements experienceRequired approvedJD" },
  { path: "recruiterId", select: "name email role" },
  { path: "interviewerId", select: "name email role" },
  { path: "requestId", select: "roundType duration notes preferredWindow status" },
  { path: "feedbackId" }
];

const ratingKeys = [
  "problemSolving",
  "backendFundamentals",
  "systemDesign",
  "databases",
  "debugging",
  "communication",
  "productionReadiness"
];

const recommendationOptions = ["Strong Hire", "Hire", "Borderline", "Reject"];

const normalizeStructuredFeedback = (body) => {
  const technicalRatings = body.technicalRatings || {};
  const missingRating = ratingKeys.find((key) => {
    const value = Number(technicalRatings[key]);
    return !Number.isFinite(value) || value < 1 || value > 10;
  });

  if (missingRating) {
    const error = new Error("All technical ratings must be numbers from 1 to 10");
    error.status = 400;
    throw error;
  }

  const recommendation = body.recommendation || body.interviewerRecommendation;
  if (!recommendationOptions.includes(recommendation)) {
    const error = new Error("Recommendation must be Strong Hire, Hire, Borderline, or Reject");
    error.status = 400;
    throw error;
  }

  const feedback = {
    technicalRatings: ratingKeys.reduce((acc, key) => {
      acc[key] = Number(technicalRatings[key]);
      return acc;
    }, {}),
    strengths: String(body.strengths || "").trim(),
    concerns: String(body.concerns || "").trim(),
    observations: String(body.observations || "").trim(),
    finalNotes: String(body.finalNotes || "").trim(),
    recommendation
  };

  if (!feedback.strengths || !feedback.concerns || !feedback.observations || !feedback.finalNotes) {
    const error = new Error("Strengths, concerns, key observations, and final notes are required");
    error.status = 400;
    throw error;
  }

  return feedback;
};

const assertDecisionAllowed = (interview) => {
  if (!interview) {
    const error = new Error("Interview not found");
    error.status = 404;
    throw error;
  }

  if (interview.recruiterDecision && interview.recruiterDecision !== "pending") {
    const error = new Error("A final decision has already been recorded for this candidate");
    error.status = 409;
    throw error;
  }

  if (!interview.feedbackId || !interview.interviewerFeedback) {
    const error = new Error("Final decisions are available only after interviewer feedback is submitted");
    error.status = 400;
    throw error;
  }

  if (!["completed", "feedback_submitted"].includes(interview.status)) {
    const error = new Error("Final decisions are available only after the interview is completed and feedback is submitted");
    error.status = 400;
    throw error;
  }
};

const getInterviewerInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({
      interviewerId: req.user._id,
      status: { $ne: "cancelled" }
    })
      .populate(interviewPopulate)
      .sort({ scheduledAt: 1 });

    logger.info("[Interview] interviewer interviews fetched", {
      interviewerId: req.user._id.toString(),
      count: interviews.length
    });

    res.json({ success: true, interviews });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to load interviews", error: error.message });
  }
};

const getRecruiterInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({})
      .populate(interviewPopulate)
      .sort({ scheduledAt: -1 });

    logger.info("[Interview] recruiter interviews fetched", {
      userId: req.user._id.toString(),
      role: req.user.role,
      count: interviews.length
    });

    res.json({ success: true, interviews });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to load recruiter interviews", error: error.message });
  }
};

const getInterviewById = async (req, res) => {
  try {
    const filter = { _id: req.params.id };

    if (req.user.role === "interviewer") {
      filter.interviewerId = req.user._id;
    }

    const interview = await Interview.findOne(filter).populate(interviewPopulate);

    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    res.json({ success: true, interview });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to load interview", error: error.message });
  }
};

const getInterviewReview = async (req, res) => {
  try {
    const filter = { _id: req.params.id };

    const interview = await Interview.findOne(filter).populate(interviewPopulate);

    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    const packet = await InterviewQuestionPacket.findOne({ interviewId: interview._id }).sort({ generatedAt: -1 });

    res.json({
      success: true,
      review: {
        interview,
        candidate: interview.candidateId,
        job: interview.jobId,
        aiEvaluation: interview.candidateId?.latestEvaluation || null,
        interviewBrief: packet || null,
        interviewerFeedback: interview.interviewerFeedback || null,
        interviewerRecommendation: interview.interviewerRecommendation || null,
        recruiterDecision: interview.recruiterDecision || "pending",
        decisionAt: interview.decisionAt || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to load interview review", error: error.message });
  }
};

const submitFeedback = async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      interviewerId: req.user._id
    });

    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    if (interview.feedbackId) {
      return res.status(409).json({ success: false, message: "Feedback has already been submitted" });
    }

    if (interview.recruiterDecision && interview.recruiterDecision !== "pending") {
      return res.status(409).json({ success: false, message: "Feedback is locked after a final recruiter decision" });
    }

    const structuredFeedback = normalizeStructuredFeedback(req.body);

    const feedback = await InterviewFeedback.create({
      interviewId: interview._id,
      interviewerId: req.user._id,
      candidateId: interview.candidateId,
      technicalRatings: structuredFeedback.technicalRatings,
      strengths: structuredFeedback.strengths,
      concerns: structuredFeedback.concerns,
      observations: structuredFeedback.observations,
      finalNotes: structuredFeedback.finalNotes,
      recommendation: structuredFeedback.recommendation,
      notes: structuredFeedback.finalNotes
    });

    interview.feedbackId = feedback._id;
    interview.interviewerFeedback = structuredFeedback;
    interview.interviewerRecommendation = structuredFeedback.recommendation;
    interview.status = "feedback_submitted";
    interview.interviewStatus = "feedback_submitted";
    await interview.save();

    await InterviewRequest.findByIdAndUpdate(interview.requestId, {
      status: "feedback_submitted"
    });

    await Candidate.findByIdAndUpdate(interview.candidateId, {
      status: "review"
    });

    const hydrated = await Interview.findById(interview._id).populate(interviewPopulate);
    res.json({
      success: true,
      message: "Feedback submitted",
      feedback,
      interview: hydrated
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to submit feedback"
    });
  }
};

const decideCandidate = async (req, res, decision) => {
  try {
    const filter = { _id: req.params.id };

    const interview = await Interview.findOne(filter).populate(interviewPopulate);
    assertDecisionAllowed(interview);

    const candidate = interview.candidateId;
    const job = interview.jobId;
    const recruiter = req.user;
    const decisionAt = new Date();

    interview.recruiterDecision = decision;
    interview.decisionAt = decisionAt;
    interview.status = decision;
    interview.interviewStatus = decision;
    await interview.save();

    await Candidate.findByIdAndUpdate(candidate._id, {
      status: decision,
      isShortlisted: false,
      shortlistedAt: null,
      shortlistedBy: null
    });
    await InterviewRequest.findByIdAndUpdate(interview.requestId, { status: decision });

    const mailPayload = {
      candidate,
      job,
      recruiter,
      companyName: process.env.COMPANY_NAME || "our team"
    };

    try {
      if (decision === "accepted") {
        await sendAcceptanceEmail(mailPayload);
      } else {
        await sendRejectionEmail(mailPayload);
      }
    } catch (emailError) {
      interview.recruiterDecision = "pending";
      interview.decisionAt = null;
      interview.status = "feedback_submitted";
      interview.interviewStatus = "feedback_submitted";
      await interview.save();
      await Candidate.findByIdAndUpdate(candidate._id, { status: "review" });
      await InterviewRequest.findByIdAndUpdate(interview.requestId, { status: "feedback_submitted" });
      throw emailError;
    }

    logger.info("[Interview] final recruiter decision recorded", {
      interviewId: interview._id.toString(),
      candidateId: candidate._id.toString(),
      recruiterId: req.user._id.toString(),
      decision
    });

    res.json({
      success: true,
      message: decision === "accepted" ? "Candidate accepted and email sent" : "Candidate rejected and email sent",
      interview: await Interview.findById(interview._id).populate(interviewPopulate)
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to record final decision"
    });
  }
};

const acceptCandidate = (req, res) => decideCandidate(req, res, "accepted");
const rejectCandidate = (req, res) => decideCandidate(req, res, "rejected");

const updateEmailStatus = async (req, res) => {
  try {
    const filter = { _id: req.params.id };

    if (req.user.role === "interviewer") {
      filter.interviewerId = req.user._id;
    }

    const interview = await Interview.findOne(filter);

    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    const nextStatus = {
      interviewer: req.body.interviewer || interview.emailStatus?.interviewer || "pending",
      candidate: req.body.candidate || interview.emailStatus?.candidate || "pending",
      error: req.body.error || "",
      lastAttemptAt: new Date()
    };

    interview.emailStatus = nextStatus;
    await interview.save();

    if (interview.requestId) {
      await InterviewRequest.findByIdAndUpdate(interview.requestId, {
        emailStatus: nextStatus,
        status: nextStatus.error ? "email_failed" : "email_sent"
      });
    }

    logger.info("[Email] interview email status updated", {
      interviewId: interview._id.toString(),
      requestId: interview.requestId?.toString() || null,
      emailStatus: nextStatus
    });

    res.json({
      success: true,
      message: "Email status updated",
      interview: await Interview.findById(interview._id).populate(interviewPopulate)
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to update email status"
    });
  }
};

module.exports = {
  getInterviewById,
  getInterviewReview,
  getInterviewerInterviews,
  getRecruiterInterviews,
  submitFeedback,
  acceptCandidate,
  rejectCandidate,
  updateEmailStatus
};
