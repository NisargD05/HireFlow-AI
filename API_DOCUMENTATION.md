# API Documentation

Base URL: `http://localhost:5000/api` (native dev) or `/api` (behind the frontend's Nginx reverse proxy in Docker).

All responses are JSON. Unless noted, authenticated endpoints require:

```
Authorization: Bearer <jwt>
```

The JWT is obtained from `POST /auth/login` and is verified on every request by `authMiddleware`, which also rejects requests from users whose email is not verified (`403`). Role-gated routes additionally run `authorizeRoles(...)`, returning `403` with `{ message, requiredRoles, currentRole }` if the caller's role doesn't match.

Two roles exist: `admin` (recruiter/HR functionality) and `interviewer`.

---

## Table of Contents

- [Auth](#auth) — `/api/auth`
- [Jobs](#jobs) — `/api/jobs`
- [Knowledge Base](#knowledge-base) — `/api/knowledge-base`
- [Candidates](#candidates) — `/api/candidates`
- [Shortlisted Candidates](#shortlisted-candidates) — `/api/shortlisted-candidates`
- [External Applications](#external-applications) — `/api/external-applications`
- [Webhooks](#webhooks) — `/api/webhooks`
- [Interview Requests](#interview-requests) — `/api/interview-requests`
- [Interviews](#interviews) — `/api/interviews`
- [Interview Agent (AI packets)](#interview-agent) — `/api/interview-agent`
- [Interviewer (legacy assignment flow)](#interviewer-legacy) — `/api/interviewer`
- [Health](#health) — `/api/health`

---

## Auth

Router: `backend/src/routes/authRoutes.js` → `authController.js`. No auth required except `/me`.

### `POST /api/auth/signup`
Creates an unverified user and emails a 6-digit OTP.

**Auth**: none
**Body**:
```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "password123", "role": "admin" }
```
- `role` must be `"admin"` or `"interviewer"`.
- `password` must be ≥ 6 characters.

**Response `201`**:
```json
{ "success": true, "message": "OTP sent to your email. Please verify to complete signup.", "email": "jane@example.com" }
```

**Errors**:
| Status | Condition |
|---|---|
| 400 | Missing field, password too short, invalid role |
| 409 | Email already registered (verified) |
| 409 | Email registered but unverified — response includes `"needsVerification": true` |
| 502 | User created but OTP email failed to send |
| 500 | Unexpected error |

### `POST /api/auth/register` (legacy alias)
Identical handler to `/signup` (routes to the same `signup` controller function).

### `POST /api/auth/verify-otp`
**Auth**: none
**Body**: `{ "email": "jane@example.com", "otp": "123456" }`
**Response `200`**: `{ "success": true, "message": "Email verified successfully. You can now login." }`

**Errors**:
| Status | Condition |
|---|---|
| 400 | Missing email/otp, already verified, OTP expired, OTP incorrect |
| 404 | User not found |
| 429 | Account locked (5+ failed attempts) — `"Too many invalid attempts..."` |
| 500 | Unexpected error |

### `POST /api/auth/resend-otp`
**Auth**: none
**Body**: `{ "email": "jane@example.com" }`
**Response `200`**: `{ "success": true, "message": "OTP sent to your email" }`

**Errors**: `400` (missing email / already verified), `404` (not found), `429` (`"Please wait N seconds..."` cooldown), `502` (email send failed).

### `POST /api/auth/login`
**Auth**: none
**Body**: `{ "email": "jane@example.com", "password": "password123" }`
**Response `200`**:
```json
{
  "token": "<jwt>",
  "user": { "id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "admin", "isVerified": true, "emailVerified": true }
}
```
**Errors**: `400` (missing fields), `401` (invalid email or password), `403` (email not verified), `500`.

### `GET /api/auth/me`
**Auth**: required (any verified user)
**Response `200`**: `{ "user": { "id", "name", "email", "role", "isVerified", "emailVerified" } }`

---

## Jobs

Router: `jobRoutes.js` → `jobController.js`. All routes: `protect` + `authorizeRoles("admin")`.

### `POST /api/jobs/create`
Creates a draft job (status `draft`).
**Body**: `{ roleName* , department, location, experienceRequired, salaryRange, skills, education, jobType, numberOfOpenings, seniorityLevel, mandatoryRequirements }` (`roleName` required; all others optional strings, `numberOfOpenings` defaults to 1).
**Response `201`**: `{ "message": "Draft job created", "job": {...} }`
**Errors**: `400` if `roleName` missing.

### `POST /api/jobs/generate-jd`
Generates (or regenerates) a job description via the AI service, using knowledge-base context retrieved by the backend's own text-search (`ragService.js`).
**Body**: either `{ jobId }` (regenerate for an existing job, optionally with updated fields) or the full job-detail fields (creates a new draft job first).
**Response `200`**:
```json
{
  "message": "Job description generated",
  "job": { "...": "...", "generatedJD": "markdown text", "status": "generated", "knowledgeBaseSources": [...] },
  "agentSteps": ["Query agent converted job inputs into a retrieval query", "..."],
  "knowledgeBaseSources": [{ "document": "...", "sourceFileName": "...", "chunkText": "...", "score": 1 }]
}
```
**Errors**: `400` (no roleName and no jobId), `404` (jobId not found), `502`/`500` (ai-service call failed — message includes hint to rebuild/restart ai-service if the route itself is missing). On failure, an `AIJobGenerationLog` document is created with `status: "failed"`.

### `PUT /api/jobs/:id/edit-jd`
Manually overwrites the generated JD text (only for jobs not yet `approved`).
**Body**: `{ "generatedJD": "..." }`
**Response `200`**: `{ "message": "Draft job description saved", "job": {...} }` (status becomes `edited`)
**Errors**: `400` (empty text, or job already `approved`), `404`.

### `POST /api/jobs/:id/approve`
Approves the job: copies `generatedJD` → `approvedJD`, sets `status: "approved"`, and generates `applicationLink`/`applicationFormProvider`/`applicationFormId` (Tally by default, from `TALLY_FORM_BASE_URL`/`TALLY_FORM_ID` or `APPLICATION_FORM_PROVIDER`/`TYPEFORM_FORM_ID`).
**Response `200`**: `{ "message": "Job approved", "job": {...} }`
**Errors**: `400` (no generatedJD yet), `404`.

### `GET /api/jobs`
Lists all **approved** jobs (sorted newest first), populated with `createdBy`.
**Response `200`**: `{ "jobs": [...] }`

### `GET /api/jobs/:id`
Fetches a single job by id (any status), populated with `createdBy` and `knowledgeBaseSources.document`.
**Response `200`**: `{ "job": {...} }`
**Errors**: `404`.

---

## Knowledge Base

Router: `knowledgeBaseRoutes.js` → `knowledgeBaseController.js`. All routes: `protect` + `authorizeRoles("admin")`.

### `POST /api/knowledge-base/upload`
Uploads a company PDF, then synchronously forwards it to the ai-service for chunking + embedding + ChromaDB indexing.
**Content-Type**: `multipart/form-data`, field name `file` (PDF only, ≤10MB — enforced by Multer's `fileFilter`/`limits`).
**Response `201`**:
```json
{ "success": true, "message": "Document uploaded successfully", "document": { "originalFileName", "status": "indexed", "chunkCount", "chromaCollectionName", "...": "..." } }
```
**Errors**:
| Status | Condition |
|---|---|
| 400 | No file attached, or non-PDF file (`"Upload rejected: only PDF files are allowed"`) |
| 413 | File exceeds 10MB (`"Upload rejected: PDF file exceeds the 10MB limit"`) |
| varies | ai-service indexing failed — document is still saved with `status: "failed"` and `indexingError`; response includes the partial `document` |

### `GET /api/knowledge-base`
Lists all uploaded documents (populated with `uploadedBy`), sorted by upload date descending.
**Response `200`**: `{ "documents": [...] }`

### `DELETE /api/knowledge-base/:id`
Deletes the document's file from disk, its `KnowledgeBaseChunk` rows, and the document record. (Note: this does not currently remove the corresponding vectors from ChromaDB itself.)
**Response `200`**: `{ "message": "Document deleted successfully" }`
**Errors**: `404`.

---

## Candidates

Router: `candidateRoutes.js` → `candidateController.js`. All routes: `protect` + `authorizeRoles("admin")`.

### `GET /api/candidates`
**Query params**: `jobId` (filter), `status` (`shortlisted` filters `isShortlisted: true`; any other value filters `Candidate.status`), `sort=score` (client-side sort by `latestEvaluation.score` descending).
**Response `200`**: `{ "candidates": [...] }` — each candidate populated with `job`, `shortlistedBy`, `resumeDocument`, `latestEvaluation`.

### `GET /api/candidates/shortlisted`
Alias behavior of the shortlisted-only view (also available at `/api/shortlisted-candidates`, see below).
**Query params**: `jobId` (optional filter).
**Response `200`**: `{ "candidates": [...], "count": N }`

### `POST /api/candidates/rank-all`
Batch-ranks every eligible candidate (must have a parsed `resumeDocument` with non-empty `resumeText`) for a given **approved** job.
**Body**: `{ "jobId": "..." }`
**Response `200`**:
```json
{
  "message": "Candidate ranking completed",
  "rankedCount": 3,
  "failedCount": 1,
  "failures": [{ "candidateId": "...", "message": "..." }],
  "candidates": [ /* ranked candidates, populated */ ]
}
```
**Errors**: `400` (`jobId` missing), `400/404` (job not found or not approved, via `ensureApprovedJob`).

### `POST /api/candidates/reset`
Deletes candidates (and cascades: resume files, `CandidateResume`, `CandidateEvaluation`, `Interview`, `InterviewRequest`, `InterviewFeedback`) for a job, or **all candidates** if `jobId` is omitted.
**Body / query**: `{ "jobId": "..." }` optional.
**Response `200`**: `{ "message": "Candidate cleanup completed", "deletedCount": N, "cleanup": { filesRemoved, resumesDeleted, evaluationsDeleted, interviewRequestsDeleted, interviewsDeleted, feedbackDeleted } }`

### `DELETE /api/candidates`
Same handler as `POST /reset` (bulk cleanup) — mounted twice for REST-style and action-style callers.

### `POST /api/candidates/:id/rank`
Ranks a single candidate against their job's approved JD (see [AI_WORKFLOW.md](AI_WORKFLOW.md) for the pipeline).
**Response `200`**: `{ "message": "Candidate ranked", "candidate": {...} }`
**Errors**:
| Status | Condition |
|---|---|
| 400 | No resume uploaded/parsed yet (`error.exclusionReason` explains why) |
| 400/404 | Job not found / not approved |
| 404 | Candidate not found |
| 502/500 | ai-service ranking call failed — candidate's `rankingStatus` set to `"failed"` with `rankingError` populated |

### `PUT /api/candidates/:id/shortlist`
Toggles shortlist state.
**Body**: `{ "status": "shortlisted" }` (any value other than `"rejected"` shortlists; `"rejected"` un-shortlists and marks the candidate rejected).
**Response `200`**: `{ "message": "Candidate status updated", "candidate": {...} }`
**Errors**: `404`, `409` (candidate already has a finalized hiring decision from a completed interview — shortlist state is locked).

### `DELETE /api/candidates/:id`
Deletes a single candidate and cascades related artifacts (same cleanup as `/reset` but scoped to one candidate).
**Response `200`**: `{ "message": "Candidate and related resume/ranking/interview data deleted", "deletedCount": 1, "cleanup": {...} }`
**Errors**: `404`.

---

## Shortlisted Candidates

Router: `shortlistedCandidateRoutes.js` → reuses `getShortlistedCandidates` from `candidateController.js`. `protect` + `authorizeRoles("admin")`.

### `GET /api/shortlisted-candidates`
Identical behavior/response to `GET /api/candidates/shortlisted` (kept as a separate resource path for the frontend's shortlist-focused views).

---

## External Applications

Router: `externalApplicationRoutes.js` → `externalApplicationController.js`. `protect` + `authorizeRoles("admin")`.

### `GET /api/external-applications/summary`
Returns the job's application link/webhook status, for the admin's "Fetch Resumes" panel.
**Query**: `jobId` (required).
**Response `200`**:
```json
{
  "success": true,
  "applicationLink": "https://tally.so/r/...?jobId=...&role=...",
  "applicationFormProvider": "tally",
  "applicationFormId": "q4eBkd",
  "applicationLinkGeneratedAt": "2026-...",
  "webhookUrl": "https://<PUBLIC_BASE_URL>/api/webhooks/tally",
  "pendingCount": 2,
  "lastFetchedAt": "2026-...",
  "latestWebhook": { "status", "resumeUrl", "resumeDetected", "importStatus", "error", "...": "..." },
  "latestWebhookAny": { "...": "..." }
}
```
**Errors**: `400` (`jobId` missing), `404` (job not found).

### `POST /api/external-applications/fetch-resumes`
Downloads every pending/failed webhook submission's resume, parses it, creates a `Candidate`, and ranks it automatically.
**Body**: `{ "jobId": "..." }`
**Response `200`**:
```json
{
  "success": true,
  "message": "Imported 2 resumes",
  "importedCount": 2,
  "duplicateCount": 0,
  "failedCount": 1,
  "failures": [{ "submissionId": "...", "email": "...", "message": "..." }],
  "candidates": [ /* imported candidates, populated + ranked */ ]
}
```
If there are no fetchable submissions: `{ "success": true, "message": "No application submissions have reached the backend yet. Configure the form webhook to <url>...", "importedCount": 0, ... }`.
**Errors**: `400` (`jobId` missing), `500` (unexpected failure).

---

## Webhooks

Router: `webhookRoutes.js` → `externalApplicationController.js`. **No authentication** (called by external form providers). Handlers always return HTTP `200` on the wire (even for validation failures) so providers don't retry-storm — the actual outcome is in the JSON body's `success`/`accepted` fields, and is separately recorded in `WebhookDebugEvent`.

### `POST /api/webhooks/tally`
Receives a Tally form submission. Extracts candidate name/email/phone/links/experience and a resume file URL from Tally's field payload (supports several Tally payload shapes), matches it to a job by a hidden `jobId` field (or auto-assigns if exactly one job is `approved`), and stores it as an `ExternalApplicationSubmission` with `importStatus: "pending"`.
**Body**: raw Tally webhook payload (`eventType: "FORM_RESPONSE"`, `data.fields[]`, etc.)
**Response `200`**: `{ "success": true, "accepted": true, "message": "Submission stored as pending", "submissionId": "..." }` or `{ "success": false, "accepted": false, "message": "Missing required webhook fields: ..." }` / `"Invalid jobId hidden field"` / `"Approved job not found for submission"`.

Note: the root `POST /` route in `app.js` also special-cases requests where `User-Agent: "Tally Webhooks"` or `body.eventType === "FORM_RESPONSE"` and routes them to this same handler, to tolerate Tally webhooks configured without the `/api/webhooks/tally` path.

### `POST /api/webhooks/typeform`
Same handling logic as Tally, tagged `source: "typeform"`.

---

## Interview Requests

Router: `interviewRequestRoutes.js` → `interviewRequestController.js`. All routes: `protect`.

### `POST /api/interview-requests`
**Auth**: `authorizeRoles("admin")`
Creates an interview request for a shortlisted candidate and assigns an interviewer by email.
**Body**:
```json
{
  "candidateId": "...", "interviewerEmail": "interviewer@company.com",
  "roundType": "Technical Round", "duration": 60,
  "preferredWindow": { "startDate": "2026-07-10", "endDate": "2026-07-12" },
  "notes": "Focus on system design"
}
```
`roundType` must be one of `HR Round | Technical Round | System Design Round | Managerial Round | Final Round`. `duration` is minutes (15–240).
**Response `201`**: `{ "success": true, "message": "Interview request created", "interviewRequest": {...} }`
**Errors**:
| Status | Condition |
|---|---|
| 400 | Missing required fields, invalid/past date range |
| 404 | Candidate not found, interviewer email doesn't match a user |
| 400 | Candidate is not currently shortlisted; or matched user's role isn't `interviewer` |
| 409 | Candidate already has an active interview request |

### `GET /api/interview-requests/recruiter`
**Auth**: `authorizeRoles("admin")` — lists requests created by the caller (or all, if `admin`).
**Response `200`**: `{ "success": true, "interviewRequests": [...] }`

### `GET /api/interview-requests/interviewer`
**Auth**: `authorizeRoles("interviewer")` — lists requests assigned to the caller with status in `pending | awaiting_interviewer_slot | email_failed`.
**Response `200`**: `{ "success": true, "interviewRequests": [...] }`

### `POST /api/interview-requests/:id/accept`
**Auth**: `authorizeRoles("interviewer")`
Interviewer picks a slot; the backend validates the slot is in the future, between 08:00–20:00 local time, within the recruiter's preferred window, and doesn't overlap the interviewer's existing calendar — then creates the `Interview`, generates a Jitsi meeting link, and sends scheduling emails to both parties.
**Body**: `{ "date": "2026-07-11", "startTime": "14:00" }`
**Response `201`**:
```json
{
  "success": true,
  "message": "Interview scheduled, meeting link created, and candidate/interviewer emails sent",
  "emailDelivery": { "success": true, "status": {...} },
  "interview": {...},
  "interviewRequest": {...}
}
```
(If email delivery fails, `success` is still `true` for the HTTP response, but the message reads `"...email delivery failed"` and `emailDelivery.success` is `false`.)
**Errors**:
| Status | Condition |
|---|---|
| 400 | Missing date/time, past date, past time today, outside 8am–8pm window, slot outside preferred window |
| 404 | Request not found |
| 409 | Request already scheduled/closed; calendar conflict with another interview |
| 502 | Meeting link generation failed (`code: "MEETING_LINK_GENERATION_FAILED"`) |

### `POST /api/interview-requests/:id/reject`
**Auth**: `authorizeRoles("interviewer")`
**Body**: `{ "reason": "..." }` (optional)
**Response `200`**: `{ "success": true, "message": "Interview request rejected", "interviewRequest": {...} }`
**Errors**: `404`, `409` (not in a rejectable status).

### `POST /api/interview-requests/:id/resend-email`
**Auth**: `authorizeRoles("interviewer")` — resends the scheduling emails for an already-scheduled interview.
**Response `200` or `502`**: `{ "success": bool, "message": "...", "emailDelivery": {...}, "interviewRequest": {...}, "interview": {...} }`
**Errors**: `404` (request or interview not found), `400` (no interview scheduled yet).

---

## Interviews

Router: `interviewRoutes.js` → `interviewController.js`. All routes: `protect`.

### `GET /api/interviews/interviewer`
**Auth**: `authorizeRoles("interviewer")` — the caller's non-cancelled interviews, sorted by `scheduledAt` ascending.
**Response `200`**: `{ "success": true, "interviews": [...] }`

### `GET /api/interviews/recruiter`
**Auth**: `authorizeRoles("admin")` — all interviews, sorted by `scheduledAt` descending.
**Response `200`**: `{ "success": true, "interviews": [...] }`

### `PUT /api/interviews/:id/email-status`
**Auth**: `authorizeRoles("admin", "interviewer")`
Manually updates the stored email delivery status (used for reconciliation).
**Body**: `{ "interviewer": "sent|failed|pending|skipped", "candidate": "...", "error": "" }`
**Response `200`**: `{ "success": true, "message": "Email status updated", "interview": {...} }`
**Errors**: `404`.

### `GET /api/interviews/:id/review`
**Auth**: `authorizeRoles("admin")`
Aggregated view for the final hiring decision: interview, candidate, job, AI evaluation, AI interview-question packet, interviewer feedback, and current recruiter decision.
**Response `200`**:
```json
{
  "success": true,
  "review": {
    "interview": {...}, "candidate": {...}, "job": {...},
    "aiEvaluation": {...} , "interviewBrief": {...} ,
    "interviewerFeedback": {...}, "interviewerRecommendation": "Hire",
    "recruiterDecision": "pending", "decisionAt": null
  }
}
```
**Errors**: `404`.

### `POST /api/interviews/:id/accept`
**Auth**: `authorizeRoles("admin")` — final hiring decision: accept. Requires interviewer feedback to already be submitted and the interview to be `completed`/`feedback_submitted`. Sends an acceptance email; if email delivery fails, the decision is rolled back (`recruiterDecision` reset to `pending`) and the error is surfaced.
**Response `200`**: `{ "success": true, "message": "Candidate accepted and email sent", "interview": {...} }`
**Errors**: `404`, `400` (feedback not yet submitted), `409` (decision already recorded), `502` (email failed — decision rolled back).

### `POST /api/interviews/:id/reject`
**Auth**: `authorizeRoles("admin")` — same as accept, but rejection email + `recruiterDecision: "rejected"`.

### `GET /api/interviews/:id`
**Auth**: `authorizeRoles("admin", "interviewer")` — interviewers are restricted to their own interviews via an implicit `interviewerId` filter.
**Response `200`**: `{ "success": true, "interview": {...} }`
**Errors**: `404`.

### `POST /api/interviews/:id/feedback` and `PUT /api/interviews/:id/feedback`
**Auth**: `authorizeRoles("interviewer")` — both verbs map to the same `submitFeedback` handler.
**Body**:
```json
{
  "technicalRatings": {
    "problemSolving": 8, "backendFundamentals": 7, "systemDesign": 6,
    "databases": 7, "debugging": 8, "communication": 9, "productionReadiness": 6
  },
  "strengths": "...", "concerns": "...", "observations": "...", "finalNotes": "...",
  "recommendation": "Hire"
}
```
- Every `technicalRatings.*` value must be an integer 1–10.
- `recommendation` must be one of `Strong Hire | Hire | Borderline | Reject`.
- `strengths`, `concerns`, `observations`, `finalNotes` are all required non-empty strings.
**Response `200`**: `{ "success": true, "message": "Feedback submitted", "feedback": {...}, "interview": {...} }`
**Errors**: `400` (validation failures above), `404`, `409` (feedback already submitted, or decision already locked).

---

## Interview Agent

Router: `interviewAgentRoutes.js` → `interviewAgentController.js`. All routes: `protect` + `authorizeRoles("admin", "interviewer")`.

### `POST /api/interview-agent/generate/:candidateId`
Generates (or returns a cached) AI interview-question packet for a candidate.
**Body**: `{ "interviewId": "...", "force": false }` — `interviewId` is **required** if the caller is an `interviewer`; optional for `admin` (generates a standalone packet not tied to a specific interview). `force: true` bypasses the cache and always calls the AI service.
**Response `201`**:
```json
{
  "success": true,
  "packet": {
    "_id", "candidateId": {...}, "interviewId": null, "jobId": {...},
    "status": "generated",
    "focusAreas": [...], "technicalQuestions": [{ "question", "whyAsk", "strongSignal" }, ...],
    "followUpQuestions": [...], "weaknessProbes": [...], "behavioralQuestions": [...],
    "systemDesignQuestions": [...], "evaluationChecklist": [...], "interviewerNotes": [...],
    "generationState": {...}, "generatedAt": "..."
  }
}
```
**Errors**:
| Status | Condition |
|---|---|
| 400 | Interviewer omitted `interviewId`; candidate has no parsed resume text; candidate has no ranking yet; interview doesn't belong to this candidate |
| 404 | Candidate not found; interview not found / not accessible to this interviewer |
| 500 | ai-service call failed |

### `GET /api/interview-agent/:interviewId`
Fetches the latest generated packet for a specific interview.
**Response `200`**: `{ "success": true, "packet": {...} }`
**Errors**: `404` (interview not found/inaccessible, or no packet generated yet).

### `POST /api/interview-agent/regenerate/:interviewId`
Forces regeneration (equivalent to `generate` with `force: true`, scoped to the interview's candidate).
**Response `201`**: same shape as `generate`.
**Errors**: same as `generate`.

---

## Interviewer (legacy)

Router: `interviewerRoutes.js` → `interviewerController.js`. All routes: `protect` + `authorizeRoles("interviewer")`. This is an alternate assignment/schedule data model (`InterviewAssignment`, `InterviewSchedule`, `Questionnaire`) that is not exercised by the current frontend (`Interviews.jsx` uses the Interview Requests / Interviews routers instead), but remains a live, fully-functional API surface.

### `GET /api/interviewer/assignments`
Lists the caller's non-cancelled assignments.
**Response `200`**: `{ "assignments": [{ id, status, invitedAt, recruiterNotes, interviewDate, workingHours, selectedTime, candidate, job, questionnaire, schedule, createdAt, updatedAt }] }`

### `GET /api/interviewer/assignments/:assignmentId`
**Response `200`**: `{ "assignment": {...} }`
**Errors**: `404`.

### `POST /api/interviewer/assignments/:assignmentId/select-slot`
Selects an interview time slot (08:00–20:00, `HH:mm`) within the assignment's working hours and generates a Jitsi meeting link + `InterviewSchedule`.
**Body**: `{ "selectedTime": "14:00" }`
**Response `201`**: `{ "message": "Interview scheduled and meeting link created", "assignment": {...} }`
**Errors**: `400` (bad format, past date, outside working hours), `404`, `409` (already scheduled).

### `GET /api/interviewer/schedules`
**Response `200`**: `{ "schedules": [{ "startsAt", "endsAt", "meetingLink", "candidate": { name, email, currentRole }, "...": "..." }] }`

---

## Health

### `GET /api/health`
**Auth**: none
**Response `200`**: `{ "status": "ok", "service": "backend", "mongoUriConfigured": true, "jwtConfigured": true, "aiServiceUrl": "http://ai-service:8000" }`

### `GET /`
**Auth**: none — root liveness check: `{ "message": "AI Hiring System API is running" }`. Also doubles as a Tally webhook receiver if the request looks like a Tally delivery (see Webhooks section).

---

## AI Service Endpoints (internal — called only by the backend)

These are not exposed to the frontend directly; they're documented here for completeness since `aiServiceClient.js` depends on their exact contracts. Base URL: `AI_SERVICE_URL` (e.g. `http://ai-service:8000`).

| Method | Path | Called by | Purpose |
|---|---|---|---|
| `POST` | `/generate-jd` | `jobController.generateJD` | Generate a job description (see [AI_WORKFLOW.md](AI_WORKFLOW.md)) |
| `POST` | `/candidates/parse-resume` | `candidateController.processCandidateResume` | Extract resume text + parsed sections from a PDF |
| `POST` | `/ranking/candidate` | `candidateController.rankSingleCandidate` | Score a candidate against a job |
| `POST` | `/interview-agent/generate` | `interviewAgentController.generateForCandidate` | Generate an interview question packet |
| `POST` | `/knowledge/index-pdf` | `aiKnowledgeIndexService.indexPdfWithAiService` | Chunk + embed + store a knowledge-base PDF in ChromaDB |
| `GET` | `/health` | manual/ops checks | ChromaDB connectivity + runtime info |
| `POST` | `/rag/retrieve` | *(not currently called by backend)* | Direct semantic retrieval endpoint |
| `GET` | `/knowledge/status` | *(not currently called by backend)* | Static readiness message |
| `POST` | `/knowledge/test-pdf` | *(not currently called by backend)* | Debug: extract text from an uploaded PDF without indexing |

Request/response schemas for each are detailed in [AI_WORKFLOW.md](AI_WORKFLOW.md).

---

## Validation Rules Summary

| Field | Rule |
|---|---|
| `User.password` | ≥ 6 characters (enforced at signup) |
| `User.role` | `admin` \| `interviewer` |
| OTP code | 6 digits, 5-minute expiry, 30s resend cooldown, locked after 5 failed attempts for 10 minutes |
| `Job.roleName` | required |
| Resume upload | `application/pdf` only, ≤ 10MB |
| Knowledge base upload | `application/pdf` only, ≤ 10MB |
| `InterviewRequest.roundType` | `HR Round \| Technical Round \| System Design Round \| Managerial Round \| Final Round` |
| `InterviewRequest.duration` | integer minutes, 15–240 |
| Interview scheduling time | must be in the future, and between 08:00–20:00 in `DEFAULT_TIMEZONE` (default `Asia/Kolkata`) |
| `InterviewFeedback.technicalRatings.*` | integer 1–10, all 7 categories required |
| `InterviewFeedback.recommendation` | `Strong Hire \| Hire \| Borderline \| Reject` |
| `CandidateEvaluation.recommendation` (AI-produced) | `Shortlist \| Review \| Reject` |
| `CandidateEvaluation.score` | integer 0–100 |
