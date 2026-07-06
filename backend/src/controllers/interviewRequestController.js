const Candidate = require("../models/Candidate");
const Interview = require("../models/Interview");
const InterviewFeedback = require("../models/InterviewFeedback");
const InterviewRequest = require("../models/InterviewRequest");
const User = require("../models/User");
const { sendInterviewScheduledEmails } = require("../services/emailService");
const { generateInterviewMeetingLink } = require("../services/meetingLinkService");
const logger = require("../utils/logger");

const requestPopulate = [
  {
    path: "candidateId",
    select: "name email phone status rankingStatus currentCompany yearsOfExperience resumeDocument latestEvaluation",
    populate: [
      { path: "resumeDocument", select: "originalFileName resumeText parsedSections filePath" },
      { path: "latestEvaluation" }
    ]
  },
  { path: "jobId", select: "roleName department location skills mandatoryRequirements experienceRequired" },
  { path: "recruiterId", select: "name email role" },
  { path: "interviewerId", select: "name email role" },
  { path: "interviewId" }
];

const interviewPopulate = [
  {
    path: "candidateId",
    select: "name email phone status rankingStatus currentCompany yearsOfExperience notes resumeDocument latestEvaluation",
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

const toUtcDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toPreferredDate = (value, boundary) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return toUtcDate(`${value}T${boundary === "end" ? "23:59:59.999" : "00:00:00.000"}Z`);
  }

  return toUtcDate(value);
};

const buildSelectedSlot = ({ date, startTime }) => {
  if (String(startTime).includes("T")) {
    return toUtcDate(startTime);
  }

  const time = String(startTime).length === 5 ? `${startTime}:00` : startTime;
  return toUtcDate(`${date}T${time}.000Z`);
};

const INTERVIEW_START_MINUTES = 8 * 60;
const INTERVIEW_END_MINUTES = 20 * 60;

const getTodayInTimezone = () => {
  const timezone = process.env.DEFAULT_TIMEZONE || "Asia/Kolkata";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getCurrentMinutesInTimezone = () => {
  const timezone = process.env.DEFAULT_TIMEZONE || "Asia/Kolkata";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
};

const getDateInputValue = (value) => {
  const text = String(value || "");

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = toUtcDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : "";
};

const getTimeMinutes = (value) => {
  const text = String(value || "");
  const timeMatch = text.match(/(?:T)?(\d{2}):(\d{2})/);

  if (!timeMatch) {
    return null;
  }

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

const isWithinInterviewTimeWindow = (value) => {
  const minutes = getTimeMinutes(value);
  return minutes !== null && minutes >= INTERVIEW_START_MINUTES && minutes <= INTERVIEW_END_MINUTES;
};

const activeRequestStatuses = [
  "pending",
  "awaiting_interviewer_slot",
  "email_pending",
  "email_failed",
  "email_sent",
  "scheduled"
];

const visibleInterviewerRequestStatuses = [
  "pending",
  "awaiting_interviewer_slot",
  "email_failed"
];

const sendAndPersistInterviewEmails = async ({ interview, request, meetingLink }) => {
  interview.emailStatus = {
    interviewer: "pending",
    candidate: "pending",
    error: "",
    lastAttemptAt: new Date()
  };
  request.emailStatus = interview.emailStatus;
  request.status = "email_pending";
  await Promise.all([interview.save(), request.save()]);

  try {
    const emailResult = await sendInterviewScheduledEmails({
      candidate: request.candidateId,
      interviewer: request.interviewerId,
      recruiter: request.recruiterId,
      job: request.jobId,
      roundType: request.roundType,
      duration: request.duration,
      notes: request.notes,
      startTime: interview.startTime,
      endTime: interview.endTime,
      meetingLink
    });

    const sentStatus = {
      interviewer: "sent",
      candidate: "sent",
      error: "",
      lastAttemptAt: new Date()
    };

    interview.emailStatus = sentStatus;
    request.emailStatus = sentStatus;
    request.status = "email_sent";
    await Promise.all([interview.save(), request.save()]);

    logger.info("[Email] interviewer sent / candidate sent", {
      requestId: request._id.toString(),
      interviewId: interview._id.toString(),
      interviewerMessageId: emailResult?.interviewer?.messageId,
      candidateMessageId: emailResult?.candidate?.messageId
    });

    return {
      success: true,
      status: sentStatus,
      result: emailResult
    };
  } catch (emailError) {
    const details = emailError.details || {};
    const failedStatus = {
      interviewer:
        details.interviewer?.status ||
        (details.interviewer?.failed ? "failed" : details.interviewer ? "sent" : "failed"),
      candidate:
        details.candidate?.status ||
        (details.candidate?.failed ? "failed" : details.candidate ? "sent" : "failed"),
      error: emailError.message,
      lastAttemptAt: new Date()
    };

    interview.emailStatus = failedStatus;
    request.emailStatus = failedStatus;
    request.status = "email_failed";
    await Promise.all([interview.save(), request.save()]);

    logger.error("[Email] interview email delivery failed", {
      requestId: request._id.toString(),
      interviewId: interview._id.toString(),
      interviewer: failedStatus.interviewer,
      candidate: failedStatus.candidate,
      error: emailError.message
    });

    return {
      success: false,
      status: failedStatus,
      message: emailError.message,
      code: emailError.code || "EMAIL_DELIVERY_FAILED"
    };
  }
};

const createInterviewRequest = async (req, res) => {
  try {
    const {
      candidateId,
      interviewerEmail,
      roundType,
      duration,
      preferredWindow,
      notes
    } = req.body;

    logger.info("[Interview Request] create request received", {
      recruiterId: req.user?._id?.toString(),
      candidateId,
      interviewerEmail,
      roundType,
      duration,
      preferredWindow
    });

    if (!candidateId || !interviewerEmail || !roundType || !duration || !preferredWindow?.startDate || !preferredWindow?.endDate) {
      return res.status(400).json({
        success: false,
        message: "candidateId, interviewerEmail, roundType, duration, preferredWindow.startDate, and preferredWindow.endDate are required"
      });
    }

    const startDate = toPreferredDate(preferredWindow.startDate, "start");
    const endDate = toPreferredDate(preferredWindow.endDate, "end");
    const today = getTodayInTimezone();
    const preferredStartDate = getDateInputValue(preferredWindow.startDate);
    const preferredEndDate = getDateInputValue(preferredWindow.endDate);

    if (!startDate || !endDate || startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "Preferred date range is invalid"
      });
    }

    if (preferredStartDate < today || preferredEndDate < today) {
      return res.status(400).json({
        success: false,
        message: "Interview date cannot be in the past."
      });
    }

    const candidate = await Candidate.findById(candidateId).populate("job");

    if (!candidate) {
      return res.status(404).json({ success: false, message: "Candidate not found" });
    }

    logger.info("[Interview Request] selected candidate refreshed", {
      candidateId: candidate._id.toString(),
      candidateName: candidate.name,
      candidateStatus: candidate.status,
      isShortlisted: candidate.isShortlisted,
      jobId: candidate.job?._id?.toString() || String(candidate.job)
    });

    if (!candidate.isShortlisted || candidate.status !== "shortlisted") {
      return res.status(400).json({
        success: false,
        message: "Only currently shortlisted candidates can be sent for interview"
      });
    }

    const existingActiveRequest = await InterviewRequest.findOne({
      candidateId: candidate._id,
      status: { $in: activeRequestStatuses }
    });

    if (existingActiveRequest) {
      return res.status(409).json({
        success: false,
        message: "This candidate already has an active interview request",
        interviewRequest: await InterviewRequest.findById(existingActiveRequest._id).populate(requestPopulate)
      });
    }

    const interviewer = await User.findOne({
      email: String(interviewerEmail).trim().toLowerCase()
    });

    if (!interviewer) {
      logger.warn("[Interview Request] interviewer email not found", {
        interviewerEmail
      });
      return res.status(404).json({
        success: false,
        message: "Interviewer does not exist"
      });
    }

    if (interviewer.role !== "interviewer") {
      logger.warn("[Interview Request] user exists but role is not interviewer", {
        interviewerEmail: interviewer.email,
        role: interviewer.role
      });
      return res.status(400).json({
        success: false,
        message: "User exists but is not an interviewer"
      });
    }

    const request = await InterviewRequest.create({
      candidateId: candidate._id,
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      jobId: candidate.job?._id || candidate.job,
      recruiterId: req.user._id,
      interviewerId: interviewer._id,
      interviewerEmail: interviewer.email,
      roundType,
      duration: Number(duration),
      preferredWindow: {
        startDate,
        endDate
      },
      notes: notes?.trim() || "",
      status: "awaiting_interviewer_slot",
      emailStatus: {
        interviewer: "pending",
        candidate: "pending",
        error: "",
        lastAttemptAt: null
      }
    });

    logger.info("[Interview Request] request created", {
      requestId: request._id.toString(),
      candidateId: candidate._id.toString(),
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      interviewerId: interviewer._id.toString(),
      recruiterId: req.user._id.toString()
    });
    logger.info("[Interview Request] interviewer assigned", {
      requestId: request._id.toString(),
      interviewerId: interviewer._id.toString(),
      interviewerEmail: interviewer.email
    });

    if (candidate.status === "shortlisted") {
      candidate.isShortlisted = true;
      candidate.shortlistedAt = candidate.shortlistedAt || new Date();
      candidate.shortlistedBy = candidate.shortlistedBy || req.user._id;
    }
    candidate.status = "assigned";
    await candidate.save();

    const hydrated = await InterviewRequest.findById(request._id).populate(requestPopulate);
    res.status(201).json({
      success: true,
      message: "Interview request created",
      interviewRequest: hydrated
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to create interview request"
    });
  }
};

const getRecruiterInterviewRequests = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { recruiterId: req.user._id };
    const requests = await InterviewRequest.find(filter)
      .populate(requestPopulate)
      .sort({ createdAt: -1 });

    res.json({ success: true, interviewRequests: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to load interview requests", error: error.message });
  }
};

const getInterviewerRequests = async (req, res) => {
  try {
    logger.info("[Interview Request] fetching interviewer requests", {
      interviewerId: req.user._id.toString(),
      statuses: visibleInterviewerRequestStatuses
    });

    const requests = await InterviewRequest.find({
      interviewerId: req.user._id,
      status: { $in: visibleInterviewerRequestStatuses }
    })
      .populate(requestPopulate)
      .sort({ createdAt: -1 });

    logger.info("[Interview Request] found N requests", {
      interviewerId: req.user._id.toString(),
      count: requests.length,
      requestIds: requests.map((request) => request._id.toString())
    });

    res.json({ success: true, interviewRequests: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to load assigned interview requests", error: error.message });
  }
};

const rejectInterviewRequest = async (req, res) => {
  try {
    const request = await InterviewRequest.findOne({
      _id: req.params.id,
      interviewerId: req.user._id
    });

    if (!request) {
      return res.status(404).json({ success: false, message: "Interview request not found" });
    }

    if (!["pending", "awaiting_interviewer_slot"].includes(request.status)) {
      return res.status(409).json({ success: false, message: "Only pending requests can be rejected" });
    }

    request.status = "rejected";
    request.rejectionReason = req.body.reason?.trim() || "";
    await request.save();

    await Candidate.findByIdAndUpdate(request.candidateId, {
      status: "shortlisted",
      isShortlisted: true,
      shortlistedAt: new Date()
    });

    res.json({ success: true, message: "Interview request rejected", interviewRequest: request });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to reject request", error: error.message });
  }
};

const acceptInterviewRequest = async (req, res) => {
  try {
    const { date, startTime } = req.body;

    logger.info("[Interview Request] accept clicked for request ID", {
      requestId: req.params.id,
      interviewerId: req.user._id.toString(),
      date,
      startTime
    });

    if (!date || !startTime) {
      return res.status(400).json({ success: false, message: "date and startTime are required" });
    }

    const request = await InterviewRequest.findOne({
      _id: req.params.id,
      interviewerId: req.user._id
    })
      .populate("candidateId")
      .populate("jobId")
      .populate("recruiterId")
      .populate("interviewerId");

    if (!request) {
      return res.status(404).json({ success: false, message: "Interview request not found" });
    }

    if (!["pending", "awaiting_interviewer_slot", "email_failed"].includes(request.status)) {
      return res.status(409).json({ success: false, message: "Interview request is already scheduled or closed" });
    }

    if (request.interviewId && request.status === "email_failed") {
      return res.status(409).json({
        success: false,
        message: "Interview is already scheduled. Use resend email for this failed invite.",
        code: "INTERVIEW_ALREADY_SCHEDULED"
      });
    }

    const today = getTodayInTimezone();
    const selectedDate = getDateInputValue(date);
    const selectedMinutes = getTimeMinutes(startTime);

    if (!selectedDate || selectedDate < today) {
      return res.status(400).json({
        success: false,
        message: "Interview date cannot be in the past."
      });
    }

    if (selectedDate === today && selectedMinutes !== null && selectedMinutes <= getCurrentMinutesInTimezone()) {
      return res.status(400).json({
        success: false,
        message: "Interview time must be in the future."
      });
    }

    if (!isWithinInterviewTimeWindow(startTime)) {
      return res.status(400).json({
        success: false,
        message: "Interview timing must be between 8:00 AM and 8:00 PM."
      });
    }

    const scheduledAt = buildSelectedSlot({ date, startTime });
    const endTime = scheduledAt ? new Date(scheduledAt.getTime() + request.duration * 60 * 1000) : null;

    logger.info("[Interview Scheduling] Computed interview window", {
      requestId: request._id.toString(),
      scheduledAt: scheduledAt?.toISOString(),
      endTime: endTime?.toISOString(),
      duration: request.duration
    });

    if (!scheduledAt || !endTime) {
      return res.status(400).json({ success: false, message: "Selected slot is invalid" });
    }

    if (scheduledAt < request.preferredWindow.startDate || scheduledAt > request.preferredWindow.endDate) {
      return res.status(400).json({ success: false, message: "Selected slot is outside the preferred date range" });
    }

    const overlap = await Interview.findOne({
      interviewerId: req.user._id,
      status: { $nin: ["cancelled"] },
      scheduledAt: { $lt: endTime },
      endTime: { $gt: scheduledAt }
    });

    if (overlap) {
      return res.status(409).json({ success: false, message: "Calendar conflict: interviewer already has an interview in this slot" });
    }

    logger.info("[Interview Scheduling] Generating meeting link before saving interview", {
      requestId: request._id.toString(),
      candidateId: request.candidateId._id.toString(),
      interviewerId: request.interviewerId._id.toString(),
      recruiterId: request.recruiterId._id.toString(),
      jobId: request.jobId._id.toString()
    });

    const meeting = generateInterviewMeetingLink({
      candidate: request.candidateId,
      job: request.jobId,
      roundType: request.roundType,
      startTime: scheduledAt,
      requestId: request._id
    });

    if (!meeting?.meetingLink || !meeting?.meetingRoomId) {
      logger.error("[Interview Scheduling] Meeting link generation failed", {
        meeting
      });

      return res.status(502).json({
        success: false,
        message: "Meeting link could not be generated. Interview was not saved.",
        code: "MEETING_LINK_GENERATION_FAILED"
      });
    }

    logger.info("[Meeting Link] generated unique link", {
      requestId: request._id.toString(),
      candidateId: request.candidateId._id.toString(),
      meetingRoomId: meeting.meetingRoomId,
      meetingLink: meeting.meetingLink,
      provider: meeting.provider
    });

    const interview = await Interview.create({
      requestId: request._id,
      candidateId: request.candidateId._id,
      candidateName: request.candidateId.name,
      jobId: request.jobId._id,
      recruiterId: request.recruiterId._id,
      interviewerId: request.interviewerId._id,
      interviewerEmail: request.interviewerId.email,
      candidateEmail: request.candidateId.email,
      preferredWindow: request.preferredWindow,
      selectedDate: date,
      selectedTime: startTime,
      meetingLink: meeting.meetingLink,
      meetingRoomId: meeting.meetingRoomId,
      scheduledAt,
      startTime: scheduledAt,
      endTime,
      roundType: request.roundType,
      duration: request.duration,
      status: "scheduled",
      interviewStatus: "scheduled"
    });

    logger.info("[MongoDB] Scheduled interview saved", {
      interviewId: interview._id.toString(),
      requestId: request._id.toString(),
      meetingRoomId: interview.meetingRoomId,
      meetingLink: interview.meetingLink,
      status: interview.status
    });

    request.status = "scheduled";
    request.interviewId = interview._id;
    request.emailStatus = {
      interviewer: "pending",
      candidate: "pending",
      error: "",
      lastAttemptAt: null
    };
    await request.save();

    logger.info("[MongoDB] Interview request marked scheduled", {
      requestId: request._id.toString(),
      interviewId: interview._id.toString(),
      status: request.status
    });

    logger.info("[Interview Request] saved successfully", {
      requestId: request._id.toString(),
      interviewId: interview._id.toString(),
      candidateId: request.candidateId._id.toString()
    });

    await Candidate.findByIdAndUpdate(request.candidateId._id, { status: "interview_scheduled" });
    logger.info("[MongoDB] Candidate marked interview_scheduled", {
      candidateId: request.candidateId._id.toString()
    });

    const emailDelivery = await sendAndPersistInterviewEmails({
      interview,
      request,
      meetingLink: meeting.meetingLink
    });

    logger.info("[Interview Scheduling] Completed successfully", {
      interviewId: interview._id.toString(),
      meetingRoomId: interview.meetingRoomId,
      meetingLink: interview.meetingLink,
      emailStatus: interview.emailStatus,
      requestStatus: request.status
    });

    const hydrated = await Interview.findById(interview._id).populate(interviewPopulate);
    res.status(201).json({
      success: true,
      message: emailDelivery.success
        ? "Interview scheduled, meeting link created, and candidate/interviewer emails sent"
        : "Interview scheduled and meeting link created, but email delivery failed",
      emailDelivery,
      interview: hydrated,
      interviewRequest: await InterviewRequest.findById(request._id).populate(requestPopulate)
    });
  } catch (error) {
    logger.error("[Interview Scheduling] Failed", {
      requestId: req.params.id,
      interviewerId: req.user?._id?.toString(),
      code: error.code,
      status: error.status,
      message: error.message
    });

    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to schedule interview",
      code: error.code
    });
  }
};

const resendInterviewEmails = async (req, res) => {
  try {
    const request = await InterviewRequest.findOne({
      _id: req.params.id,
      interviewerId: req.user._id
    })
      .populate("candidateId")
      .populate("jobId")
      .populate("recruiterId")
      .populate("interviewerId");

    if (!request) {
      return res.status(404).json({ success: false, message: "Interview request not found" });
    }

    if (!request.interviewId) {
      return res.status(400).json({ success: false, message: "No scheduled interview exists for this request yet" });
    }

    const interview = await Interview.findById(request.interviewId);
    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found for this request" });
    }

    const emailDelivery = await sendAndPersistInterviewEmails({
      interview,
      request,
      meetingLink: interview.meetingLink
    });

    const hydrated = await InterviewRequest.findById(request._id).populate(requestPopulate);
    res.status(emailDelivery.success ? 200 : 502).json({
      success: emailDelivery.success,
      message: emailDelivery.success ? "Interview emails resent successfully" : emailDelivery.message,
      emailDelivery,
      interviewRequest: hydrated,
      interview: await Interview.findById(interview._id).populate(interviewPopulate)
    });
  } catch (error) {
    logger.error("[Email] resend failed", {
      requestId: req.params.id,
      interviewerId: req.user?._id?.toString(),
      message: error.message
    });

    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to resend interview emails"
    });
  }
};

module.exports = {
  acceptInterviewRequest,
  createInterviewRequest,
  getInterviewerRequests,
  getRecruiterInterviewRequests,
  rejectInterviewRequest,
  resendInterviewEmails
};
