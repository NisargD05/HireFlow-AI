const Job = require("../models/Job");
const AIJobGenerationLog = require("../models/AIJobGenerationLog");
const { retrieveRelevantKnowledge } = require("../services/ragService");
const { generateJobDescription } = require("../services/aiServiceClient");
const logger = require("../utils/logger");

const buildApplicationLink = (job) => {
  const provider = (process.env.APPLICATION_FORM_PROVIDER || "tally").toLowerCase();
  const formId = process.env.TALLY_FORM_ID || process.env.TYPEFORM_FORM_ID || "81R4oY";
  const baseUrl =
    process.env.APPLICATION_FORM_BASE_URL ||
    process.env.TALLY_FORM_BASE_URL ||
    `https://tally.so/r/${formId}`;
  const link = new URL(baseUrl);

  link.searchParams.set("jobId", job._id.toString());
  link.searchParams.set("role", job.roleName);

  return {
    applicationLink: link.toString(),
    applicationFormProvider: provider === "typeform" ? "typeform" : "tally",
    applicationFormId: formId,
    applicationLinkGeneratedAt: new Date()
  };
};

const normalizeJobInput = (body) => ({
  roleName: body.roleName?.trim(),
  department: body.department?.trim() || "",
  location: body.location?.trim() || "",
  experienceRequired: body.experienceRequired?.trim() || "",
  salaryRange: body.salaryRange?.trim() || "",
  skills: body.skills?.trim() || "",
  education: body.education?.trim() || "",
  jobType: body.jobType?.trim() || "",
  numberOfOpenings: Number(body.numberOfOpenings) || 1,
  seniorityLevel: body.seniorityLevel?.trim() || "",
  mandatoryRequirements: body.mandatoryRequirements?.trim() || ""
});

const sanitizeGeneratedJD = (value) => {
  const forbiddenSectionPattern = /^(#{1,6}\s*)?(company-specific context used|knowledge base context|retrieved context|source documents?|sources used|information gathered from knowledge base|rag metadata)\b/i;
  const forbiddenLinePattern = /(source documents? used|retrieved context|knowledge base context|information gathered from knowledge base|rag metadata|source file|source filename)/i;
  const lines = String(value || "").split(/\r?\n/);
  const cleaned = [];
  let skippingForbiddenSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading = /^#{1,6}\s+\S/.test(trimmed) || /^[A-Z][A-Za-z -]+:$/.test(trimmed);

    if (forbiddenSectionPattern.test(trimmed)) {
      skippingForbiddenSection = true;
      continue;
    }

    if (skippingForbiddenSection && isHeading) {
      skippingForbiddenSection = false;
    }

    if (skippingForbiddenSection || forbiddenLinePattern.test(trimmed)) {
      continue;
    }

    cleaned.push(line);
  }

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

const createJob = async (req, res) => {
  try {
    const jobDetails = normalizeJobInput(req.body);

    if (!jobDetails.roleName) {
      return res.status(400).json({ message: "Role name is required" });
    }

    const job = await Job.create({
      ...jobDetails,
      createdBy: req.user._id,
      status: "draft"
    });

    logger.info("Draft job created", {
      jobId: job._id.toString(),
      userId: req.user._id.toString(),
      roleName: job.roleName
    });

    res.status(201).json({ message: "Draft job created", job });
  } catch (error) {
    logger.error("Failed to create job", {
      userId: req.user?._id?.toString(),
      error: error.message
    });
    res.status(500).json({ message: "Failed to create job", error: error.message });
  }
};

const generateJD = async (req, res) => {
  let job;

  try {
    const jobDetails = normalizeJobInput(req.body);

    if (!jobDetails.roleName && !req.body.jobId) {
      return res.status(400).json({ message: "Role name is required" });
    }

    if (req.body.jobId) {
      job = await Job.findById(req.body.jobId);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
    } else {
      job = await Job.create({
        ...jobDetails,
        createdBy: req.user._id,
        status: "draft"
      });
    }

    const mergedJobDetails = normalizeJobInput({
      ...job.toObject(),
      ...jobDetails,
      roleName: jobDetails.roleName || job.roleName
    });

    const knowledgeContext = await retrieveRelevantKnowledge(mergedJobDetails);
    const aiResponse = await generateJobDescription({
      jobDetails: mergedJobDetails,
      knowledgeContext
    });
    const generatedJD = sanitizeGeneratedJD(aiResponse.jobDescription);

    job.set({
      ...mergedJobDetails,
      generatedJD,
      status: "generated",
      knowledgeBaseSources: knowledgeContext
    });
    await job.save();

    await AIJobGenerationLog.create({
      job: job._id,
      requestedBy: req.user._id,
      promptSummary: `Generated JD for ${job.roleName}`,
      sourceCount: knowledgeContext.length,
      status: "success"
    });

    logger.info("Job description generated", {
      jobId: job._id.toString(),
      userId: req.user._id.toString(),
      sourceCount: knowledgeContext.length
    });

    res.json({
      message: "Job description generated",
      job,
      agentSteps: aiResponse.agentSteps || [],
      knowledgeBaseSources: knowledgeContext
    });
  } catch (error) {
    if (job) {
      await AIJobGenerationLog.create({
        job: job._id,
        requestedBy: req.user._id,
        promptSummary: `Failed JD generation for ${job.roleName}`,
        status: "failed",
        errorMessage: error.message
      });
    }

    logger.error("Failed to generate job description", {
      jobId: job?._id?.toString(),
      userId: req.user?._id?.toString(),
      error: error.message,
      details: error.details
    });

    res.status(error.status || 500).json({
      message: "Failed to generate job description",
      error: error.message,
      details: error.details || null
    });
  }
};

const editJD = async (req, res) => {
  try {
    const { generatedJD } = req.body;

    if (!generatedJD || !generatedJD.trim()) {
      return res.status(400).json({ message: "Job description text is required" });
    }

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.status === "approved") {
      return res.status(400).json({ message: "Approved jobs cannot be edited here" });
    }

    job.generatedJD = sanitizeGeneratedJD(generatedJD);
    job.status = "edited";
    await job.save();

    logger.info("Job description edited", {
      jobId: job._id.toString(),
      userId: req.user._id.toString()
    });

    res.json({ message: "Draft job description saved", job });
  } catch (error) {
    logger.error("Failed to save job description", {
      jobId: req.params.id,
      userId: req.user?._id?.toString(),
      error: error.message
    });
    res.status(500).json({ message: "Failed to save job description", error: error.message });
  }
};

const approveJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (!job.generatedJD || !job.generatedJD.trim()) {
      return res.status(400).json({ message: "Generate or write a JD before approval" });
    }

    job.approvedJD = job.generatedJD;
    job.status = "approved";
    job.set(buildApplicationLink(job));
    await job.save();

    logger.info("Job approved", {
      jobId: job._id.toString(),
      userId: req.user._id.toString(),
      applicationLink: job.applicationLink
    });

    res.json({ message: "Job approved", job });
  } catch (error) {
    logger.error("Failed to approve job", {
      jobId: req.params.id,
      userId: req.user?._id?.toString(),
      error: error.message
    });
    res.status(500).json({ message: "Failed to approve job", error: error.message });
  }
};

const getJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ status: "approved" })
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch jobs", error: error.message });
  }
};

const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate("createdBy", "name email role")
      .populate("knowledgeBaseSources.document", "originalFileName");

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch job", error: error.message });
  }
};

module.exports = {
  createJob,
  generateJD,
  editJD,
  approveJob,
  getJobs,
  getJobById
};
