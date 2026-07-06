const crypto = require("crypto");

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);

const getMeetingBaseUrl = () => trimTrailingSlash(process.env.JITSI_BASE_URL || "https://meet.jit.si");

const generateRoomId = ({ candidate, job, roundType, startTime, requestId }) => {
  const prefix = slugify(process.env.MEETING_ROOM_PREFIX || "aihiring");
  const candidateSlug = slugify(candidate?._id || candidate?.name || "candidate");
  const jobSlug = slugify(job?.roleName || job?.roleTitle || "interview");
  const roundSlug = slugify(roundType || "round");
  const requestSlug = slugify(requestId || "request");
  const timestamp = startTime instanceof Date ? startTime.getTime().toString(36) : Date.now().toString(36);
  const random = crypto.randomBytes(5).toString("hex");

  return [prefix, jobSlug, candidateSlug, requestSlug, roundSlug, timestamp, random]
    .filter(Boolean)
    .join("-");
};

const generateInterviewMeetingLink = ({ candidate, job, roundType, startTime, requestId }) => {
  const meetingRoomId = generateRoomId({ candidate, job, roundType, startTime, requestId });
  const meetingLink = `${getMeetingBaseUrl()}/${meetingRoomId}`;

  return {
    meetingLink,
    meetingRoomId,
    provider: "jitsi"
  };
};

module.exports = {
  generateInterviewMeetingLink
};
