# Developer Guide

This is the onboarding reference for engineers working on the AI Agentic HR System. Read [ARCHITECTURE.md](ARCHITECTURE.md) first for the system-level picture; this document focuses on day-to-day conventions and how to extend the codebase safely.

## Project Structure

```
New HIring/
├── docker-compose.yml
├── backend/                # Node.js + Express API
│   ├── src/
│   │   ├── app.js          # Express wiring: CORS, body parsers, routes, error handler
│   │   ├── server.js        # Mongo connect + listen
│   │   ├── config/db.js
│   │   ├── models/          # Mongoose schemas (one file per collection)
│   │   ├── controllers/     # Business logic, one file per resource
│   │   ├── routes/          # Express routers, one file per resource
│   │   ├── middleware/      # authMiddleware, roleMiddleware, uploadMiddleware
│   │   ├── services/        # External integrations (ai-service client, email, RAG, meeting links)
│   │   └── utils/logger.js
│   ├── scripts/              # One-off Node scripts (run with `node scripts/<name>.js`)
│   └── uploads/               # Multer disk storage (gitignored)
├── ai-service/                # Python FastAPI AI microservice
│   └── app/
│       ├── main.py           # Router registration only
│       ├── jd/                # JD generation capability
│       ├── resume/            # Resume parsing capability (no LLM)
│       ├── ranking/           # Candidate ranking capability
│       ├── interview/         # Interview packet generation capability
│       ├── knowledge/         # PDF ingestion + RAG retrieval routes
│       └── shared/            # Cross-capability code: llm/, chroma/, embeddings/, document/,
│                                # rag/, tools/, config/, schemas/, models/, exceptions/, logging/, base/
└── frontend/                   # React + Vite SPA
    └── src/
        ├── api/axios.js       # The one shared HTTP client — always import this, never instantiate a new one
        ├── context/AuthContext.jsx
        ├── components/         # Reusable UI (ui/, interviews/, and top-level shared components)
        └── pages/               # Route-level screens (interviewer/, recruiter/ subfolders by role)
```

## Local Development Setup

### Prerequisites
- Node.js 18+, Python 3.12, Docker (for MongoDB/ChromaDB even if you run backend/ai-service natively)
- A Gemini API key and SMTP credentials (see [README.md](README.md#environment-setup) for the full variable list)

### Fastest path: Docker Compose for everything

```bash
docker compose up -d --build
docker compose logs -f backend ai-service   # watch for startup errors
```

### Iterative development: native services + Docker for stateful stores

```bash
docker compose up -d mongo chromadb

cd ai-service && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

cd backend && npm install
npm run dev     # nodemon — auto-restarts on file change

cd frontend && npm install
npm run dev      # Vite dev server with HMR, default http://localhost:5173
```

When running natively, `backend/.env` needs `AI_SERVICE_URL=http://localhost:8000` and Mongo/Chroma pointed at `localhost` rather than Docker service names.

### Creating a test account without email delivery

If SMTP isn't configured yet, you can still exercise the app by flipping verification flags directly in Mongo after signing up:

```bash
docker exec ai-hiring-mongo mongosh ai_hiring_system --quiet --eval \
  'db.users.updateOne({email:"you@example.com"},{$set:{isVerified:true,emailVerified:true}})'
```

## Coding Conventions

### Backend (Node/Express)
- **CommonJS** (`require`/`module.exports`) throughout — do not introduce ESM syntax.
- Controllers are plain async functions `(req, res) => {...}` wrapped in `try/catch`; errors are turned into `res.status(error.status || 500).json({ message, error })`. Attach a custom `.status` to thrown errors to control the HTTP code (see `ensureApprovedJob` in `candidateController.js` for the pattern).
- Routes always apply `protect` (JWT auth) then `authorizeRoles(...roles)` before the handler — never skip auth on a new authenticated route.
- Logging goes through `utils/logger.js` (`logger.info/warn/error(message, metaObject)`), which prefixes an ISO timestamp — do not use raw `console.log` in new code.
- All calls to the AI service go through `services/aiServiceClient.js` — do not `axios.post` the ai-service directly from a controller.
- File uploads go through `middleware/uploadMiddleware.js`'s `createPdfUploader(folderName)` factory — reuse it for any new PDF-upload endpoint rather than configuring Multer inline.

### AI Service (Python/FastAPI)
- Each capability package (`jd/`, `resume/`, `ranking/`, `interview/`, `knowledge/`) is self-contained: `routes.py` (FastAPI router), `schemas.py` (Pydantic request/response models), and either a flat `service.py` (resume, knowledge) or a full LangGraph pipeline split into `context.py` / `prompts.py` / `graph.py` / `parser.py` / `validators.py` (jd, ranking, interview).
- **Always call Gemini through `invoke_chain_with_model_fallback`** (`shared/llm/invoker.py`), never `get_llm(...).invoke(...)` directly in a new chain — this is what makes the app resilient to per-model quota exhaustion. Build your chain function to accept a `model_name: str | None` parameter (see `ranking/chains.py::build_ranking_chain` for the pattern) and pass a lambda: `lambda model_name: build_my_chain(model_name=model_name)`.
- Every graph node returns a **new dict** (`{**state, "key": value}`), never mutates `state` in place — this is required for LangGraph's state tracking to work correctly.
- Retry ceilings use `shared/base/graph.py`'s `should_retry(passed, retry_count, max_retries=2)` / `increment_retry(retry_count)` helpers — reuse them rather than hand-rolling a retry counter.
- Pydantic models: note that a field named `_id` is **not** a real Pydantic v2 field unless declared with `Field(alias="_id")` and `model_config = ConfigDict(populate_by_name=True)` (see `interview/schemas.py`'s `InterviewCandidatePayload`/`InterviewJobPayload` for the correct pattern). `ranking/schemas.py`'s `CandidatePayload`/`JobPayload` currently declare a bare `_id: Optional[str] = ""` field, which Pydantic silently treats as a private attribute and drops — this is harmless today (nothing downstream reads it) but do not copy that pattern for any field you actually need to use.

### Frontend (React)
- All HTTP calls go through the shared `api` instance from `src/api/axios.js` (JWT injection + 401 handling are centralized there) — never instantiate a second Axios client.
- Route protection: wrap new admin-only pages in `<RoleRoute allowedRoles={["admin"]}>`, interviewer-only pages in `<RoleRoute allowedRoles={["interviewer"]}>`, both inside `<ProtectedRoute>`. Remember this is a UX convenience only — the backend independently enforces the same roles.
- New admin/recruiter pages nest under the `/dashboard` route tree in `App.jsx` (rendered inside `DashboardLayout`'s `<Outlet/>`); new interviewer pages are added as sibling top-level routes under `/interviewer/*`, each individually wrapped in `<AppLayout>`.
- Styling is Tailwind utility classes plus a handful of custom classes in `src/styles.css` (e.g. `.surface`, `.status-badge`, `.chip`) — check `styles.css` before inventing a new visual pattern.
- No global state library is used beyond `AuthContext` — page-level state is local `useState`/`useEffect`; keep it that way unless a genuine cross-page state need arises.

## Adding New Features

### Adding a new backend endpoint
1. Add the Mongoose model field/collection if needed (`src/models/`).
2. Add a controller function in the relevant `src/controllers/*.js` (or a new file, following the existing naming pattern).
3. Wire it in the matching `src/routes/*.js` with `protect` + `authorizeRoles(...)`.
4. If it needs AI, add a client function to `services/aiServiceClient.js` calling the ai-service, and a corresponding route/schema/service in `ai-service/app/<capability>/`.
5. Update [API_DOCUMENTATION.md](API_DOCUMENTATION.md) with the new endpoint's contract.

### Adding a new AI capability
1. Create `ai-service/app/<capability>/` with `schemas.py` (Pydantic request/response), `routes.py` (`APIRouter`), and either `service.py` or a full graph (`context.py`, `prompts.py`, `graph.py`, `parser.py`, `validators.py`, modeled on `ranking/` or `interview/`).
2. Register the router in `ai-service/app/main.py`.
3. Use `invoke_chain_with_model_fallback` for any Gemini call.
4. Add a client function to `backend/src/services/aiServiceClient.js`.
5. Document the prompt flow in [AI_WORKFLOW.md](AI_WORKFLOW.md).

### Adding a new frontend page
1. Create the component under `src/pages/` (or `src/pages/interviewer/` / `src/pages/recruiter/` if role-specific).
2. Add a `<Route>` in `App.jsx`, wrapped in the appropriate guards (see Coding Conventions above).
3. Add any new nav links in `DashboardLayout.jsx` (admin) or `AppLayout.jsx` (interviewer).
4. Call the backend only via `src/api/axios.js`'s `api` instance.

## Debugging

- **Backend logs**: `docker compose logs -f backend` (or console output if running natively via `npm run dev`). Every controller logs key lifecycle events (`logger.info`) with structured metadata — search for the bracketed tag (e.g. `[Candidate Ranking]`, `[Fetch Resumes]`, `[Interview Scheduling]`) to trace a specific flow.
- **ai-service logs**: `docker compose logs -f ai-service`. FastAPI/uvicorn logs each request; LangGraph node exceptions are caught within the graph and stored in `state["error"]`, so a `500` from the API doesn't always mean an unhandled Python exception — check the response body's `detail`/`message` first.
- **Reproducing a Gemini quota/rate-limit failure**: exec into the ai-service container and call the chain builder directly, e.g.:
  ```bash
  docker exec ai-service python3 -c "
  from app.ranking.chains import build_ranking_chain
  build_ranking_chain().invoke({'payload_json': '{...}'})
  "
  ```
  A `google.api_core.exceptions.ResourceExhausted` traceback confirms quota exhaustion; verify `GEMINI_FALLBACK_MODELS` is non-empty and those models are enabled on your Gemini plan.
- **Symptom: ranking/interview output is generic placeholder text** (`"No weakness detail returned"`, empty question arrays) — this means every configured Gemini model failed for that request. See [AI_WORKFLOW.md](AI_WORKFLOW.md#error-handling--retry-logic--summary).
- **Symptom: `AI service route not found at ...`** — the ai-service image is stale relative to the backend's expected routes; rebuild it: `docker compose up -d --build ai-service`.
- **Inspecting Mongo directly**:
  ```bash
  docker exec ai-hiring-mongo mongosh ai_hiring_system --quiet --eval 'db.candidates.find().limit(5).pretty()'
  ```
- **Webhook debugging**: every Tally/Typeform delivery is recorded in `WebhookDebugEvent` regardless of success/failure — query it via `GET /api/external-applications/summary?jobId=...` (`latestWebhook`/`latestWebhookAny`) rather than guessing from webhook provider logs.

## Testing

There is **no automated test suite** in this repository (no Jest/Mocha/pytest configuration, no CI test job). Verification is manual:

1. Bring up the full stack (`docker compose up -d --build`).
2. Confirm health: `curl http://localhost:5000/api/health` and `curl http://localhost:8000/health`.
3. Drive the flow you changed end-to-end through the real API (or UI) — signup → verify → login → create/approve a job → ingest a candidate → rank → shortlist → schedule an interview → generate a packet → submit feedback → accept/reject — using `curl` or the browser.
4. Check both `backend` and `ai-service` container logs for unexpected errors during your test.
5. If you touch a Mongoose model, verify existing documents still populate/query correctly (no required-field additions without a default, since there's no migration tooling).

If you add a new script for repeatable manual verification, put it under `backend/scripts/` following the existing pattern (`resetCandidateData.js`, `syncInterviewEmailStatus.js`, `verifyRankAll.js` — each is a standalone Node script run via `node scripts/<name>.js [--flags]`, connecting directly to Mongo via `MONGO_URI`).

## Best Practices

- **Minimum viable diff**: this codebase has no test suite and no code review automation beyond human review — keep changes scoped to the feature/bug at hand. Don't bundle refactors with fixes.
- **Preserve the retry/fallback patterns**: any new Gemini-calling code must go through `invoke_chain_with_model_fallback`; any new resume/PDF-processing code should keep the "PDF extraction has no LLM dependency" property so ranking/interview issues never block basic resume ingestion.
- **Respect the RBAC boundary in both layers**: adding a frontend route guard is not sufficient — the backend route must independently enforce `authorizeRoles`.
- **Don't leak secrets into generated content**: JD generation, ranking, and interview generation all have "don't mention retrieval/RAG internals" guards in their prompts and post-processing (`sanitizeGeneratedJD`, `remove_internal_context`) — keep this invariant if you touch those prompts.
- **Cascade deletes carefully**: `candidateController.cleanupCandidateArtifacts` and the equivalent `backend/scripts/resetCandidateData.js` show the full fan-out (resume file, `CandidateResume`, `CandidateEvaluation`, `InterviewFeedback`, `Interview`, `InterviewRequest`) that must be cleaned up when a candidate is deleted — mirror this if you add a new candidate-linked collection.
- **Environment-variable driven config only** — there's no config file layer beyond `.env`; new tunables should follow the existing `process.env.X || default` / `os.getenv("X", default)` pattern.
