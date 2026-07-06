const axios = require("axios");
const fs = require("fs/promises");
const mongoose = require("mongoose");
const path = require("path");
const ExternalApplicationSubmission = require("../models/ExternalApplicationSubmission");
const WebhookDebugEvent = require("../models/WebhookDebugEvent");
const Candidate = require("../models/Candidate");
const Job = require("../models/Job");
const { importExternalCandidateSubmission } = require("./candidateController");
const logger = require("../utils/logger");

const resumeUploadRoot = path.resolve(__dirname, "../../uploads/resumes");
const FETCHABLE_IMPORT_STATUSES = ["pending", "failed", "pending_failed", "downloading", "downloaded"];

const ensureResumeUploadDir = async () => {
  await fs.mkdir(resumeUploadRoot, { recursive: true });
};

const normalizeKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const safeJsonStringify = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return `[unserializable payload: ${error.message}]`;
  }
};

const summarizeHeaders = (headers = {}) => ({
  "content-type": headers["content-type"] || "",
  "content-length": headers["content-length"] || "",
  "user-agent": headers["user-agent"] || "",
  "x-forwarded-for": headers["x-forwarded-for"] || "",
  "x-forwarded-host": headers["x-forwarded-host"] || "",
  "x-forwarded-proto": headers["x-forwarded-proto"] || "",
  "tally-signature": headers["tally-signature"] ? "[present]" : ""
});

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

const shouldRefreshApplicationLink = (job) => {
  const expected = buildApplicationLink(job);

  if (!job.applicationLink || job.applicationFormId !== expected.applicationFormId) {
    return true;
  }

  try {
    const current = new URL(job.applicationLink);
    const next = new URL(expected.applicationLink);
    return (
      current.origin !== next.origin ||
      current.pathname !== next.pathname ||
      current.searchParams.get("jobId") !== job._id.toString() ||
      current.searchParams.get("role") !== job.roleName
    );
  } catch {
    return true;
  }
};

const buildWebhookUrl = () => {
  const publicBaseUrl = (process.env.WEBHOOK_PUBLIC_BASE_URL || process.env.PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");
  const path = "/api/webhooks/tally";
  return publicBaseUrl ? `${publicBaseUrl}${path}` : path;
};

const getNested = (object, pathParts) =>
  pathParts.reduce((current, part) => (current && current[part] !== undefined ? current[part] : undefined), object);

const stringifyFieldValue = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map(stringifyFieldValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    const textValue =
      value.value ??
      value.text ??
      value.label ??
      value.name ??
      value.email ??
      value.phone_number ??
      value.url ??
      value.href;

    return stringifyFieldValue(textValue);
  }

  return String(value).trim();
};

const extractFileUrl = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return /^https?:\/\//i.test(value) ? value : "";
  }

  if (Array.isArray(value)) {
    return value.map(extractFileUrl).find(Boolean) || "";
  }

  if (typeof value === "object") {
    const directUrl = value.url || value.href || value.downloadUrl || value.fileUrl || value.src || value.signedUrl;
    if (directUrl) {
      return extractFileUrl(directUrl);
    }

    for (const nestedValue of Object.values(value)) {
      const nestedUrl = extractFileUrl(nestedValue);
      if (nestedUrl) {
        return nestedUrl;
      }
    }
  }

  return "";
};

const flattenFields = (payload) => {
  const fields = [];
  const sourceArrays = [
    payload?.fields,
    payload?.data?.fields,
    payload?.event?.fields,
    payload?.form_response?.answers,
    payload?.answers,
    payload?.data?.answers,
    payload?.data?.hiddenFields,
    payload?.data?.hidden_fields,
    payload?.hiddenFields,
    payload?.hidden_fields,
    payload?.data?.uploaded_files,
    payload?.data?.uploadedFiles,
    payload?.uploaded_files,
    payload?.uploadedFiles
  ].filter(Array.isArray);

  for (const fieldArray of sourceArrays) {
    for (const field of fieldArray) {
      const label = field.label || field.title || field.name || field.key || field.id || field.ref;
      const value =
        field.value ??
        field.answer ??
        field.text ??
        field.email ??
        field.phone_number ??
        field.url ??
        field.file_url ??
        field.raw_value ??
        field.files ??
        field.choices?.labels ??
        field.choice?.label;

      if (label) {
        fields.push({
          key: normalizeKey(label),
          rawKey: field.key || field.id || field.ref || "",
          label,
          type: field.type || "",
          value,
          raw: field
        });
      }

      if (normalizeKey(field.type).includes("hidden") && value && typeof value === "object" && !Array.isArray(value)) {
        for (const [hiddenKey, hiddenValue] of Object.entries(value)) {
          fields.push({
            key: normalizeKey(hiddenKey),
            rawKey: hiddenKey,
            label: hiddenKey,
            type: "HIDDEN_FIELDS",
            value: hiddenValue,
            raw: { key: hiddenKey, value: hiddenValue, parent: field }
          });
        }
      }
    }
  }

  for (const objectPath of [["data"], ["form_response"], []]) {
    const source = objectPath.length ? getNested(payload, objectPath) : payload;
    if (source && typeof source === "object" && !Array.isArray(source)) {
      for (const [key, value] of Object.entries(source)) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
          fields.push({ key: normalizeKey(key), rawKey: key, label: key, type: "", value, raw: { key, value } });
        }
      }
    }
  }

  const hiddenObjects = [
    payload?.data?.hiddenFields,
    payload?.data?.hidden_fields,
    payload?.data?.hidden,
    payload?.hiddenFields,
    payload?.hidden_fields,
    payload?.hidden
  ];

  for (const hidden of hiddenObjects) {
    if (Array.isArray(hidden)) {
      for (const field of hidden) {
        const key = field.key || field.name || field.label || field.id || field.ref;
        const value = field.value ?? field.answer ?? field.text;

        if (key) {
          fields.push({ key: normalizeKey(key), rawKey: key, label: key, type: "HIDDEN_FIELDS", value, raw: field });
        }
      }
    } else if (hidden && typeof hidden === "object") {
      for (const [key, value] of Object.entries(hidden)) {
        fields.push({ key: normalizeKey(key), rawKey: key, label: key, type: "HIDDEN_FIELDS", value, raw: { key, value } });
      }
    }
  }

  return fields;
};

const fieldMatches = (field, possibleNames) => {
  const haystack = [field.key, normalizeKey(field.rawKey), normalizeKey(field.label)].filter(Boolean);
  const aliases = possibleNames.map(normalizeKey).filter(Boolean);
  return aliases.some((alias) => haystack.some((value) => value === alias || value.includes(alias)));
};

const getFieldValue = (fields, aliases) => {
  const match = fields.find((field) => fieldMatches(field, aliases));
  return stringifyFieldValue(match?.value);
};

const getFieldRawValue = (fields, aliases) => {
  return fields.find((field) => fieldMatches(field, aliases))?.value;
};

const getHiddenFieldValue = (fields, aliases) => {
  const hiddenMatch = fields.find((field) => {
    const type = normalizeKey(field.type);
    return (type.includes("hidden") || field.raw?.type === "HIDDEN_FIELDS") && fieldMatches(field, aliases);
  });

  if (hiddenMatch) {
    return getFieldValue([hiddenMatch], aliases);
  }

  return getFieldValue(fields, aliases);
};

const getExactHiddenFieldValue = (fields, exactName) => {
  const match = fields.find((field) => {
    const type = normalizeKey(field.type);
    return (
      (type.includes("hidden") || field.raw?.type === "HIDDEN_FIELDS") &&
      (field.rawKey === exactName || field.label === exactName || field.raw?.key === exactName)
    );
  });

  return stringifyFieldValue(match?.value);
};

const getResumeUrl = (fields, payload) => {
  const fileUploadField = fields.find((field) => normalizeKey(field.type).includes("fileupload"));
  const resumeNamedField = fields.find((field) => fieldMatches(field, ["resume", "resume upload", "resumeupload", "cv", "cover letter"]));
  const explicitResumeUrl = getFieldRawValue(fields, ["resume url", "cv url", "file url", "download url"]);

  return (
    extractFileUrl(fileUploadField?.value) ||
    extractFileUrl(fileUploadField?.raw) ||
    extractFileUrl(resumeNamedField?.value) ||
    extractFileUrl(resumeNamedField?.raw) ||
    extractFileUrl(explicitResumeUrl) ||
    extractFileUrl(payload?.data?.uploaded_files) ||
    extractFileUrl(payload?.data?.uploadedFiles) ||
    extractFileUrl(payload?.uploaded_files) ||
    extractFileUrl(payload?.uploadedFiles) ||
    ""
  );
};

const extractSubmission = (payload, provider) => {
  const fields = flattenFields(payload);
  const jobId =
    getExactHiddenFieldValue(fields, "jobId") ||
    payload?.jobId ||
    payload?.data?.job_id ||
    payload?.data?.jobId ||
    payload?.data?.hidden?.jobId ||
    payload?.data?.hiddenFields?.jobId ||
    payload?.data?.hidden_fields?.jobId ||
    payload?.hidden?.jobId ||
    payload?.hiddenFields?.jobId ||
    payload?.hidden_fields?.jobId ||
    getHiddenFieldValue(fields, ["jobId", "job id", "job_id"]);
  const role =
    getExactHiddenFieldValue(fields, "role") ||
    payload?.role ||
    payload?.data?.role ||
    payload?.data?.hidden?.role ||
    payload?.data?.hiddenFields?.role ||
    payload?.data?.hidden_fields?.role ||
    payload?.hidden?.role ||
    payload?.hiddenFields?.role ||
    payload?.hidden_fields?.role ||
    getHiddenFieldValue(fields, ["role", "role name", "job role"]);
  const firstName = getFieldValue(fields, ["first name", "candidate name", "name", "full name"]);
  const lastName = getFieldValue(fields, ["last name"]);
  const candidateName = [firstName, lastName].filter(Boolean).join(" ").trim() || firstName;
  const resumeUrl = getResumeUrl(fields, payload);

  return {
    jobId: String(jobId || "").trim(),
    role: String(role || "").trim(),
    formId: payload?.formId || payload?.data?.formId || payload?.data?.form_id || payload?.form_response?.form_id || "",
    submissionId:
      payload?.submissionId ||
      payload?.eventId ||
      payload?.data?.submissionId ||
      payload?.data?.responseId ||
      payload?.data?.id ||
      payload?.form_response?.token ||
      "",
    candidateName,
    email: getFieldValue(fields, ["email", "email address"]).toLowerCase(),
    phone: getFieldValue(fields, ["phone", "phone number", "mobile"]),
    linkedinUrl: getFieldValue(fields, ["linkedin", "linkedin url", "linkedin profile"]),
    githubUrl: getFieldValue(fields, ["github", "github url"]),
    portfolioUrl: getFieldValue(fields, ["portfolio", "portfolio url", "website"]),
    experience: getFieldValue(fields, ["years of experience", "experience"]),
    currentCompany: getFieldValue(fields, ["current company", "company"]),
    resumeUrl,
    source: provider
  };
};

const summarizeFields = (fields) =>
  fields.map((field) => ({
    label: field.label,
    rawKey: field.rawKey,
    type: field.type,
    normalizedKey: field.key,
    valuePreview: stringifyFieldValue(field.value).slice(0, 300),
    fileUrlDetected: extractFileUrl(field.value) || extractFileUrl(field.raw) || ""
  }));

const summarizeHiddenFields = (fields) =>
  fields
    .filter((field) => {
      const type = normalizeKey(field.type);
      return type.includes("hidden") || field.raw?.type === "HIDDEN_FIELDS";
    })
    .map((field) => ({
      label: field.label,
      rawKey: field.rawKey,
      value: stringifyFieldValue(field.value)
    }));

const updateWebhookDebugForSubmission = async (submission, update) => {
  const filters = [
    ...(submission.submissionId ? [{ submissionId: submission.submissionId }] : []),
    { rawJobId: submission.jobId.toString(), email: submission.email }
  ];

  await WebhookDebugEvent.findOneAndUpdate(
    { $or: filters },
    update,
    { sort: { createdAt: -1 } }
  );
};

const serializeWebhookDebugEvent = (event, fallbackRole = "") => {
  if (!event) {
    return null;
  }

  const serialized = typeof event.toObject === "function" ? event.toObject() : { ...event };
  const resumeDetected = Boolean(serialized.resumeDetected || serialized.resumeUrl);

  return {
    ...serialized,
    role: serialized.role || fallbackRole || "",
    resumeDetected
  };
};

const storeWebhookSubmission = async (req, res, provider) => {
  let debugEvent;
  const webhookName = provider === "typeform" ? "Typeform" : "Tally";
  try {
    logger.info(`[${webhookName} Webhook] Request received`, {
      method: req.method,
      path: req.originalUrl,
      contentType: req.headers["content-type"],
      contentLength: req.headers["content-length"] || "",
      query: req.query,
      receivedAt: new Date().toISOString()
    });
    logger.info(`[${webhookName} Webhook] Headers`, summarizeHeaders(req.headers));
    logger.info(`[${webhookName} Webhook] Raw body`, {
      body: safeJsonStringify(req.body)
    });

    const flattenedFields = flattenFields(req.body);
    const extracted = extractSubmission(req.body, provider);
    const hiddenFields = summarizeHiddenFields(flattenedFields);

    logger.info(`[${webhookName} Webhook] Flattened field summary`, {
      fieldCount: flattenedFields.length,
      fields: summarizeFields(flattenedFields)
    });
    logger.info(`[${webhookName} Webhook] Hidden fields`, {
      hiddenFieldCount: hiddenFields.length,
      hiddenFields
    });
    logger.info(`[${webhookName} Webhook] Parsed body`, extracted);

    logger.info(`[${webhookName} Webhook] Resume URL extraction`, {
      resumeUrl: extracted.resumeUrl,
      resumeDetected: Boolean(extracted.resumeUrl)
    });
    logger.info(`[${webhookName} Webhook] Extracted intake fields`, {
      jobId: extracted.jobId,
      role: extracted.role,
      resumeUrl: extracted.resumeUrl,
      resumeDetected: Boolean(extracted.resumeUrl),
      email: extracted.email,
      submissionId: extracted.submissionId
    });
    logger.info("[TallyWebhook] jobId extracted", { jobId: extracted.jobId || null });
    logger.info("[TallyWebhook] role extracted", { role: extracted.role || null });
    logger.info("[TallyWebhook] resume URL extracted", { resumeUrl: extracted.resumeUrl || null });

    debugEvent = await WebhookDebugEvent.create({
      provider,
      status: "received",
      rawJobId: extracted.jobId || "",
      role: extracted.role || "",
      candidateName: extracted.candidateName || "",
      email: extracted.email || "",
      resumeUrl: extracted.resumeUrl || "",
      resumeDetected: Boolean(extracted.resumeUrl),
      formId: extracted.formId || "",
      submissionId: extracted.submissionId || "",
      parsedFields: extracted,
      headers: req.headers,
      webhookPayload: req.body
    });
    logger.info(`[${webhookName} Webhook] Debug event created`, {
      debugEventId: debugEvent._id.toString(),
      status: debugEvent.status,
      importStatus: debugEvent.importStatus
    });

    let job = null;

    if (!extracted.jobId) {
      const approvedJobs = await Job.find({ status: "approved" }).sort({ createdAt: -1 }).limit(2);
      if (approvedJobs.length === 1) {
        job = approvedJobs[0];
        extracted.jobId = job._id.toString();
        extracted.role = extracted.role || job.roleName || "";
        debugEvent.rawJobId = extracted.jobId;
        debugEvent.jobId = job._id;
        debugEvent.role = extracted.role;
        await debugEvent.save();
        logger.warn(`[${webhookName} Webhook] jobId hidden field missing; assigned only approved job`, {
          jobId: extracted.jobId,
          role: extracted.role
        });
      }
    }

    if (!extracted.jobId || !extracted.candidateName || !extracted.email || !extracted.resumeUrl) {
      const missing = [
        !extracted.jobId ? "jobId" : "",
        !extracted.candidateName ? "candidate name" : "",
        !extracted.email ? "email" : "",
        !extracted.resumeUrl ? "resume URL" : ""
      ].filter(Boolean).join(", ");
      debugEvent.status = "invalid";
      debugEvent.error = `Missing required webhook fields: ${missing}`;
      debugEvent.resumeDetected = Boolean(extracted.resumeUrl);
      await debugEvent.save();

      logger.warn(`[${webhookName} Webhook] Validation error`, {
        missing,
        parsedFields: extracted
      });

      return res.status(200).json({
        success: false,
        accepted: false,
        message: `Missing required webhook fields: ${missing}`
      });
    }

    if (!mongoose.Types.ObjectId.isValid(extracted.jobId)) {
      debugEvent.status = "invalid";
      debugEvent.error = "Invalid jobId hidden field";
      debugEvent.resumeDetected = Boolean(extracted.resumeUrl);
      await debugEvent.save();

      logger.warn(`[${webhookName} Webhook] Validation error`, {
        missing: "",
        parsedFields: extracted,
        error: "Invalid jobId hidden field"
      });

      return res.status(200).json({
        success: false,
        accepted: false,
        message: "Invalid jobId hidden field"
      });
    }

    if (!job) {
      job = await Job.findById(extracted.jobId);
    }
    if (!job || job.status !== "approved") {
      debugEvent.status = "invalid";
      debugEvent.error = "Approved job not found for submission";
      await debugEvent.save();

      return res.status(200).json({
        success: false,
        accepted: false,
        message: "Approved job not found for submission"
      });
    }

    logger.info(`[${webhookName} Webhook] DB insert start`, {
      jobId: job._id.toString(),
      submissionId: extracted.submissionId || "",
      email: extracted.email,
      importStatus: "pending"
    });

    const submission = await ExternalApplicationSubmission.findOneAndUpdate(
      {
        $or: [
          ...(extracted.submissionId ? [{ submissionId: extracted.submissionId }] : []),
          { jobId: job._id, email: extracted.email }
        ]
      },
      {
        $set: {
          ...extracted,
          jobId: job._id,
          webhookPayload: req.body,
          importStatus: "pending",
          importError: ""
        },
        $setOnInsert: {
          importedCandidateId: null,
          importedAt: null
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    logger.info(`[${webhookName} Webhook] DB insert status`, {
      submissionId: submission._id.toString(),
      jobId: job._id.toString(),
      email: submission.email,
      importStatus: submission.importStatus
    });

    debugEvent.status = "stored";
    debugEvent.jobId = job._id;
    debugEvent.importStatus = "pending";
    debugEvent.resumeDetected = Boolean(submission.resumeUrl);
    await debugEvent.save();

    logger.info(`[${webhookName} Webhook] Import status`, {
      debugEventId: debugEvent._id.toString(),
      submissionId: submission._id.toString(),
      importStatus: submission.importStatus,
      candidateImported: false
    });
    logger.info(`[${webhookName} Webhook] Submission saved successfully`, {
      submissionId: submission._id.toString(),
      jobId: job._id.toString()
    });

    res.status(200).json({ success: true, accepted: true, message: "Submission stored as pending", submissionId: submission._id });
  } catch (error) {
    if (debugEvent) {
      debugEvent.status = "failed";
      debugEvent.error = error.message;
      await debugEvent.save().catch(() => {});
    }
    logger.error(`[${webhookName} Webhook] Failed`, {
      message: error.message,
      name: error.name,
      stack: error.stack,
      debugEventId: debugEvent?._id?.toString() || null
    });
    return res.status(200).json({
      success: false,
      accepted: false,
      error: error.message || "Webhook submission failed",
      message: error.message || "Webhook submission failed"
    });
  }
};

const tallyWebhook = (req, res) => storeWebhookSubmission(req, res, "tally");
const typeformWebhook = (req, res) => storeWebhookSubmission(req, res, "typeform");

const getApplicationSummary = async (req, res) => {
  try {
    const { jobId } = req.query;

    if (!jobId) {
      return res.status(400).json({ success: false, message: "jobId is required" });
    }

    const [job, pendingCount, lastImported, latestForJob, latestAny] = await Promise.all([
      Job.findById(jobId).select("roleName status applicationLink applicationFormProvider applicationFormId applicationLinkGeneratedAt"),
      ExternalApplicationSubmission.countDocuments({ jobId, importStatus: { $in: FETCHABLE_IMPORT_STATUSES } }),
      ExternalApplicationSubmission.findOne({ jobId, importStatus: { $in: ["imported", "completed"] } }).sort({ importedAt: -1 }).select("importedAt"),
      WebhookDebugEvent.findOne({ jobId }).sort({ createdAt: -1 }).select("status rawJobId role candidateName email resumeUrl resumeDetected importStatus candidateImported error createdAt"),
      WebhookDebugEvent.findOne({}).sort({ createdAt: -1 }).select("status rawJobId role candidateName email resumeUrl resumeDetected importStatus candidateImported error createdAt")
    ]);

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (job.status === "approved" && shouldRefreshApplicationLink(job)) {
      job.set(buildApplicationLink(job));
      await job.save();
    }

    res.json({
      success: true,
      applicationLink: job.applicationLink,
      applicationFormProvider: job.applicationFormProvider,
      applicationFormId: job.applicationFormId,
      applicationLinkGeneratedAt: job.applicationLinkGeneratedAt,
      webhookUrl: buildWebhookUrl(),
      pendingCount,
      lastFetchedAt: lastImported?.importedAt || null,
      latestWebhook: serializeWebhookDebugEvent(latestForJob, job.roleName),
      latestWebhookAny: serializeWebhookDebugEvent(latestAny)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to load application summary", error: error.message });
  }
};

const getResumeFileName = (resumeUrl, fallbackName) => {
  try {
    const parsed = new URL(resumeUrl);
    const name = path.basename(parsed.pathname) || fallbackName;
    return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
  } catch {
    return fallbackName;
  }
};

const downloadResume = async (submission) => {
  await ensureResumeUploadDir();
  const originalName = getResumeFileName(submission.resumeUrl, `${submission.candidateName || "resume"}.pdf`).replace(/[^a-zA-Z0-9.-]/g, "_");
  const storedFileName = `${Date.now()}-${submission._id}-${originalName}`;
  const filePath = path.join(resumeUploadRoot, storedFileName);
  logger.info("[Fetch Resumes] Resume download start", {
    submissionId: submission._id.toString(),
    resumeUrl: submission.resumeUrl,
    filePath
  });
  const response = await axios.get(submission.resumeUrl, {
    responseType: "arraybuffer",
    maxRedirects: 5,
    timeout: 30000,
    headers: {
      Accept: "application/pdf,application/octet-stream,*/*"
    },
    validateStatus: (status) => status >= 200 && status < 300
  });

  await fs.writeFile(filePath, response.data);

  logger.info("[Fetch Resumes] Resume downloaded", {
    submissionId: submission._id.toString(),
    filePath,
    contentType: response.headers["content-type"] || "",
    size: response.data.length
  });

  return {
    originalname: originalName,
    filename: storedFileName,
    path: filePath,
    mimetype: response.headers["content-type"] || "application/pdf",
    size: response.data.length
  };
};

const fetchResumes = async (req, res) => {
  const { jobId } = req.body;

  try {
    logger.info("[Fetch Resumes] Started", {
      jobId,
      userId: req.user?._id?.toString()
    });

    if (!jobId) {
      return res.status(400).json({ success: false, message: "jobId is required" });
    }

    const pendingSubmissions = await ExternalApplicationSubmission.find({
      jobId,
      importStatus: { $in: FETCHABLE_IMPORT_STATUSES }
    }).sort({ createdAt: 1 });

    logger.info("[Fetch Resumes] Selected job: %s", jobId);
    logger.info("[Fetch Resumes] Query: %j", { jobId, importStatus: { $in: FETCHABLE_IMPORT_STATUSES } });
    logger.info("[Fetch Resumes] Pending submissions found: %s", pendingSubmissions.length);
    logger.info("[Fetch Resumes] Submission IDs: %j", pendingSubmissions.map((submission) => submission._id.toString()));

    if (pendingSubmissions.length === 0) {
      const [submissionCount, latestWebhook] = await Promise.all([
        ExternalApplicationSubmission.countDocuments({ jobId }),
        WebhookDebugEvent.findOne({
          $or: [
            { jobId },
            { rawJobId: jobId }
          ]
        }).sort({ createdAt: -1 }).select("status error resumeDetected createdAt")
      ]);
      const message = submissionCount === 0 && !latestWebhook
        ? `No application submissions have reached the backend yet. Configure the form webhook to ${buildWebhookUrl()} and submit the form again.`
        : "No resumes are currently available to fetch for this job.";

      logger.info("[Fetch Resumes] No fetchable submissions", { jobId, submissionCount, latestWebhookId: latestWebhook?._id?.toString() || null });
      return res.json({
        success: true,
        message,
        importedCount: 0,
        duplicateCount: 0,
        failedCount: 0,
        failures: [],
        latestWebhook: serializeWebhookDebugEvent(latestWebhook)
      });
    }

    const imported = [];
    const duplicates = [];
    const failures = [];

    for (const submission of pendingSubmissions) {
      try {
        const duplicate = await Candidate.findOne({
          email: submission.email,
          job: submission.jobId
        }).select("_id");

        if (duplicate) {
          submission.importStatus = "duplicate";
          submission.importedCandidateId = duplicate._id;
          submission.importedAt = new Date();
          await submission.save();
          await updateWebhookDebugForSubmission(submission, {
            importStatus: "duplicate",
            candidateImported: false,
            importedCandidateId: duplicate._id,
            error: "Candidate already imported for this job"
          });
          duplicates.push(submission._id.toString());
          logger.info("[TallyWebhook] duplicate skipped", {
            submissionId: submission._id.toString(),
            candidateId: duplicate._id.toString(),
            jobId: submission.jobId.toString(),
            email: submission.email
          });
          continue;
        }

        submission.importStatus = "downloading";
        await submission.save();
        await updateWebhookDebugForSubmission(submission, {
          importStatus: "downloading",
          candidateImported: false,
          error: ""
        });

        const file = await downloadResume(submission);
        submission.importStatus = "downloaded";
        await submission.save();
        await updateWebhookDebugForSubmission(submission, {
          importStatus: "downloaded",
          candidateImported: false,
          error: ""
        });

        logger.info("[TallyWebhook] ranking triggered", {
          submissionId: submission._id.toString(),
          jobId: submission.jobId.toString(),
          role: submission.role || "",
          email: submission.email
        });
        const result = await importExternalCandidateSubmission({ submission, file });

        if (result.status === "duplicate") {
          submission.importStatus = "duplicate";
          submission.importedCandidateId = result.candidate?._id || null;
          submission.importedAt = new Date();
          await submission.save();
          await updateWebhookDebugForSubmission(submission, {
            importStatus: "duplicate",
            candidateImported: false,
            importedCandidateId: result.candidate?._id || null,
            error: "Candidate already imported for this job"
          });
          duplicates.push(submission._id.toString());
          logger.info("[TallyWebhook] duplicate skipped", {
            submissionId: submission._id.toString(),
            candidateId: result.candidate?._id?.toString() || null,
            jobId: submission.jobId.toString(),
            email: submission.email
          });
          continue;
        }

        submission.importStatus = "completed";
        submission.importedCandidateId = result.candidate?._id || null;
        submission.importedAt = new Date();
        submission.importError = "";
        await submission.save();
        await updateWebhookDebugForSubmission(submission, {
          importStatus: "completed",
          candidateImported: true,
          importedCandidateId: result.candidate?._id || null,
          error: ""
        });
        logger.info("[TallyWebhook] candidate created", {
          submissionId: submission._id.toString(),
          candidateId: result.candidate?._id?.toString() || null,
          jobId: submission.jobId.toString(),
          email: submission.email
        });
        logger.info("[TallyWebhook] ranking completed", {
          submissionId: submission._id.toString(),
          candidateId: result.candidate?._id?.toString() || null
        });
        imported.push(result.candidate);
      } catch (error) {
        submission.importStatus = "failed";
        submission.importError = error.message;
        await submission.save();
        await updateWebhookDebugForSubmission(submission, {
          importStatus: "failed",
          candidateImported: false,
          error: error.message || "Import failed"
        });
        failures.push({ submissionId: submission._id.toString(), email: submission.email, message: error.message });
        logger.error("[Fetch Resumes] Submission import failed", {
          submissionId: submission._id.toString(),
          email: submission.email,
          message: error.message
        });
      }
    }

    logger.info("[Fetch Resumes] Completed", {
      jobId,
      importedCount: imported.length,
      duplicateCount: duplicates.length,
      failedCount: failures.length
    });

    res.json({
      success: true,
      message: `Imported ${imported.length} resume${imported.length === 1 ? "" : "s"}`,
      importedCount: imported.length,
      duplicateCount: duplicates.length,
      failedCount: failures.length,
      failures,
      candidates: imported
    });
  } catch (error) {
    logger.error("[Fetch Resumes] Failed", {
      jobId,
      message: error.message
    });
    res.status(500).json({ success: false, message: error.message || "Unable to fetch resumes" });
  }
};

module.exports = {
  fetchResumes,
  getApplicationSummary,
  tallyWebhook,
  typeformWebhook
};
