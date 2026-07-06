const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const logger = require("../utils/logger");

const getAiServiceUrl = () => process.env.AI_SERVICE_URL || "http://localhost:8000";

const extractAiError = (error, fallbackMessage) => {
  const responseData = error.response?.data;
  const endpoint = error.config?.url || "";
  const routeMissing =
    error.response?.status === 404 &&
    (endpoint.includes("/candidates/parse-resume") || endpoint.includes("/ranking/candidate"));
  const message =
    (routeMissing
      ? `AI service route not found at ${endpoint}. Rebuild/restart the AI service so candidate resume parsing and ranking routes are available.`
      : "") ||
    responseData?.message ||
    responseData?.detail?.message ||
    responseData?.detail ||
    error.message ||
    fallbackMessage;

  const wrappedError = new Error(
    typeof message === "string" ? message : JSON.stringify(message)
  );
  wrappedError.status = error.response?.status || 502;
  wrappedError.details = responseData;
  return wrappedError;
};

const generateJobDescription = async ({ jobDetails, knowledgeContext }) => {
  const aiServiceUrl = getAiServiceUrl();
  const endpoint = `${aiServiceUrl}/generate-jd`;

  logger.info("Requesting JD generation from AI service", {
    endpoint,
    roleName: jobDetails.roleName,
    knowledgeContextCount: knowledgeContext.length
  });

  try {
    const { data } = await axios.post(
      endpoint,
      {
        jobDetails,
        knowledgeContext
      },
      {
        timeout: 120000
      }
    );

    logger.info("AI service returned generated JD", {
      roleName: jobDetails.roleName,
      agentStepCount: data.agentSteps?.length || 0
    });

    return data;
  } catch (error) {
    const wrappedError = extractAiError(error, "AI service JD generation request failed");

    logger.error("AI service JD generation failed", {
      endpoint,
      status: error.response?.status,
      message: wrappedError.message,
      responseData: error.response?.data
    });

    throw wrappedError;
  }
};

const parseCandidateResume = async ({ filePath, originalFileName }) => {
  const endpoint = `${getAiServiceUrl()}/candidates/parse-resume`;
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), {
    filename: originalFileName,
    contentType: "application/pdf"
  });

  try {
    logger.info("[Resume Indexing] AI parse request started", {
      endpoint,
      originalFileName,
      filePath
    });

    const { data } = await axios.post(endpoint, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000
    });

    logger.info("[Resume Indexing] AI parse request completed", {
      endpoint,
      originalFileName,
      resumeTextLength: (data.resumeText || "").length,
      skillsCount: data.parsedSections?.skills?.length || 0
    });

    return data;
  } catch (error) {
    const wrappedError = extractAiError(error, "AI service resume parsing request failed");
    logger.error("AI service resume parsing failed", {
      endpoint,
      status: error.response?.status,
      message: wrappedError.message,
      responseData: error.response?.data
    });
    throw wrappedError;
  }
};

const rankCandidate = async ({ candidate, resume, job }) => {
  const endpoint = `${getAiServiceUrl()}/ranking/candidate`;

  try {
    logger.info("[Candidate Ranking] AI ranking request started", {
      endpoint,
      candidateId: candidate?._id,
      jobId: job?._id,
      resumeTextLength: (resume?.resumeText || "").length
    });

    const { data } = await axios.post(
      endpoint,
      {
        candidate,
        resume,
        job
      },
      {
        timeout: 120000
      }
    );

    logger.info("[Candidate Ranking] AI ranking request completed", {
      endpoint,
      candidateId: candidate?._id,
      jobId: job?._id,
      score: data.score,
      recommendation: data.recommendation
    });

    return data;
  } catch (error) {
    const wrappedError = extractAiError(error, "AI service candidate ranking request failed");
    logger.error("AI service candidate ranking failed", {
      endpoint,
      candidateId: candidate?._id,
      jobId: job?._id,
      status: error.response?.status,
      message: wrappedError.message,
      responseData: error.response?.data
    });
    throw wrappedError;
  }
};

const generateInterviewQuestionPacket = async ({ candidate, resume, ranking, job, interview }) => {
  const endpoint = `${getAiServiceUrl()}/interview-agent/generate`;

  try {
    logger.info("[InterviewQuestionAgent] AI request started", {
      endpoint,
      candidateId: candidate?._id,
      jobId: job?._id,
      interviewId: interview?._id || null
    });

    const { data } = await axios.post(
      endpoint,
      {
        candidate,
        resume,
        ranking,
        job,
        interview
      },
      {
        timeout: 120000
      }
    );

    logger.info("[InterviewQuestionAgent] AI request completed", {
      endpoint,
      candidateId: candidate?._id,
      focusAreaCount: data.packet?.focusAreas?.length || 0
    });

    return data;
  } catch (error) {
    const wrappedError = extractAiError(error, "AI service interview question generation request failed");
    logger.error("[InterviewQuestionAgent] AI request failed", {
      endpoint,
      candidateId: candidate?._id,
      jobId: job?._id,
      status: error.response?.status,
      message: wrappedError.message,
      responseData: error.response?.data
    });
    throw wrappedError;
  }
};

module.exports = {
  generateJobDescription,
  generateInterviewQuestionPacket,
  parseCandidateResume,
  rankCandidate
};
