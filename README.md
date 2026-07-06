# AI Agentic HR System

An AI-powered recruitment and hiring management platform that automates job description generation, candidate resume parsing, AI-driven candidate ranking, and AI-generated interview question packets — all grounded in a company-specific knowledge base via Retrieval-Augmented Generation (RAG).

The system is a three-service application:

- **frontend/** — React 18 + Vite single-page app (recruiter/admin and interviewer dashboards)
- **backend/** — Node.js + Express REST API (auth, business logic, MongoDB persistence, orchestration)
- **ai-service/** — Python FastAPI microservice (LangChain/LangGraph multi-agent workflows, Google Gemini LLM, ChromaDB vector store)

For a deeper dive into each subsystem, see:

- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture, request lifecycle, service interactions
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — every backend REST endpoint
- [AI_WORKFLOW.md](AI_WORKFLOW.md) — LLM prompt flows, ranking, parsing, interview generation
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — onboarding, conventions, adding features
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — deployment, environment variables, operations

---

## Features

### Authentication & Authorization
- Email/password signup with **OTP email verification** (6-digit code, 5-minute expiry, 30-second resend cooldown, lockout after 5 failed attempts)
- JWT-based session auth (`Authorization: Bearer <token>`)
- Two roles: `admin` (recruiter/HR) and `interviewer`, enforced via route-level middleware

### Job Management & AI Job Description Generation
- Create draft jobs with role, department, skills, experience, seniority, mandatory requirements
- Generate a full job description with a 5-agent LangGraph pipeline (query → retrieve → context → write → review), grounded in the company Knowledge Base
- Manual edit and recruiter approval workflow; approval auto-generates a public application link (Tally/Typeform)

### Knowledge Base (RAG)
- Upload company PDFs (policies, hiring rubrics, culture docs)
- Backend extracts/chunks text and forwards to the AI service, which embeds chunks (Sentence Transformers) and stores them in ChromaDB
- Knowledge is retrieved and injected into JD generation, candidate ranking, and interview-question prompts

### Candidate Ingestion
- **Webhook ingestion**: Tally/Typeform form submissions land as `pending` `ExternalApplicationSubmission` records (`POST /api/webhooks/tally`, `/typeform`)
- **Fetch Resumes**: an admin-triggered action downloads each pending submission's resume file, parses it, creates a `Candidate`, and automatically ranks it (`POST /api/external-applications/fetch-resumes`)

### AI Resume Parsing
- PDF text extraction (pdfplumber, falling back to pypdf) with regex-based section detection (skills, experience, projects, education, certifications) — no LLM call involved

### AI Candidate Ranking
- LangGraph pipeline retrieves company hiring standards from ChromaDB and asks Gemini to score the candidate 0–100 against the approved JD, returning matched/missing skills, strengths, weaknesses, a recommendation (`Shortlist`/`Review`/`Reject`), and a ranking reason
- Automatic retry-with-validation-feedback loop, plus **model fallback** across configured Gemini models on quota/rate-limit errors

### Shortlisting & Interview Scheduling
- Recruiters shortlist ranked candidates and send interview requests to interviewers (round type, duration, preferred date window)
- Interviewers accept/reject and pick a slot (8 AM–8 PM window); accepting auto-generates a Jitsi meeting link and emails both parties

### AI Interview Question Packet Generation
- LangGraph pipeline builds candidate/job/ranking context, retrieves company interview guidance from ChromaDB, and asks Gemini for focus areas, technical/behavioral/system-design questions, weakness probes, an evaluation checklist, and interviewer notes
- Same retry + model-fallback resilience as ranking

### Feedback & Hiring Decisions
- Interviewers submit structured feedback (7 technical ratings 1–10, strengths/concerns/observations/final notes, recommendation)
- Recruiters make the final accept/reject decision, which triggers outcome emails

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, React Router 7, Tailwind CSS 3, Axios |
| Backend | Node.js, Express 4, Mongoose 8 (MongoDB), JWT (`jsonwebtoken`), `bcryptjs`, Multer, Nodemailer, `pdf-parse` |
| AI Service | Python 3.12, FastAPI, LangChain + LangGraph, `langchain-google-genai` (Gemini), `langchain-huggingface` (Sentence Transformers embeddings), ChromaDB |
| Database | MongoDB 7 |
| Vector Store | ChromaDB 0.5.23 |
| LLM Provider | Google Gemini (`gemini-2.0-flash` primary, with configurable fallback models) |
| Infra | Docker + Docker Compose, Nginx (frontend static + reverse proxy) |

---

## Project Structure

```
New HIring/
├── docker-compose.yml            # 5 services: chromadb, mongo, ai-service, backend, frontend
├── backend/
│   ├── src/
│   │   ├── app.js                # Express app, CORS, route mounting, error handler
│   │   ├── server.js             # Mongo connection + HTTP listen
│   │   ├── config/db.js
│   │   ├── models/               # Mongoose schemas (17 models)
│   │   ├── controllers/          # Route handlers / business logic
│   │   ├── routes/               # Express routers
│   │   ├── middleware/           # authMiddleware, roleMiddleware, uploadMiddleware
│   │   ├── services/             # aiServiceClient, ragService, emailService, otpEmailService,
│   │   │                         # meetingLinkService, pdfTextService, knowledge index services
│   │   └── utils/logger.js
│   ├── scripts/                  # One-off maintenance scripts (candidate reset, email status sync)
│   └── uploads/{resumes,knowledge-base}/  # Multer disk storage (not committed)
├── ai-service/
│   └── app/
│       ├── main.py               # FastAPI app, router registration
│       ├── jd/                   # JD generation: schemas, prompts, graph (LangGraph), parser, validators
│       ├── resume/                # Resume parsing (no LLM): parser, routes, schemas, service
│       ├── ranking/               # Candidate ranking: chains, context, graph, parser, prompts, validators
│       ├── interview/             # Interview packet generation: context, graph, orchestrator, parser,
│       │                         # prompts, service, validators
│       ├── knowledge/             # PDF ingestion + RAG retrieval routes
│       └── shared/
│           ├── llm/               # gemini_client.py (get_llm), invoker.py (model-fallback retry)
│           ├── chroma/            # client.py (Chroma connection), store.py (upsert/search + JSON fallback)
│           ├── embeddings/        # Sentence-Transformers embedding service
│           ├── document/          # pdf_extractor.py, cleaner.py
│           ├── rag/               # chunker.py, retriever.py
│           ├── tools/              # LangChain tool-calling helpers (hiring_tools.py)
│           ├── config/settings.py # Environment-driven settings
│           └── schemas/, models/, exceptions/, logging/, routes/health.py, base/graph.py
└── frontend/
    └── src/
        ├── main.jsx, App.jsx     # Router + route tree
        ├── api/axios.js          # Axios instance, JWT interceptor
        ├── context/AuthContext.jsx
        ├── components/           # AppLayout, DashboardLayout, ProtectedRoute, RoleRoute, ui/, interviews/
        └── pages/                # Login, Register, VerifyOTP, Dashboard, CreateJob, JobListings,
                                   # JobDetails, KnowledgeBase, Candidates, Interviews,
                                   # interviewer/*, recruiter/*
```

---

## Installation

### Prerequisites
- Docker + Docker Compose (recommended path), **or**
- Node.js 18+, Python 3.12, MongoDB 7, ChromaDB, for running services natively
- A Google Gemini API key ([ai.google.dev](https://ai.google.dev)) — free tier is rate-limited; ranking and interview generation will fall back to configured alternate models under quota pressure
- SMTP credentials (e.g. a Gmail account with an App Password) for OTP and notification emails

### Clone and configure

```bash
git clone <repo-url>
cd "New HIring"
```

Copy the environment templates and fill in real values (see [Environment Setup](#environment-setup) below):

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# ai-service/.env is not templated — create it manually (see Environment Setup)
```

---

## Environment Setup

### `backend/.env`

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (default `5000`) | Backend HTTP port |
| `MONGO_URI` | **yes** | MongoDB connection string |
| `JWT_SECRET` | **yes** | JWT signing secret |
| `JWT_EXPIRES_IN` | no (default `7d`) | JWT expiry |
| `CLIENT_URL` | **yes** | Comma-separated allowed CORS origins |
| `AI_SERVICE_URL` | **yes** | Base URL of the ai-service (e.g. `http://localhost:8000`) |
| `APPLICATION_FORM_PROVIDER` | no (default `tally`) | `tally` or `typeform` |
| `TALLY_FORM_BASE_URL` / `TALLY_FORM_ID` | no | Public application form used to build `job.applicationLink` |
| `TYPEFORM_FORM_ID` | no | Alternate provider form id |
| `WEBHOOK_PUBLIC_BASE_URL` / `PUBLIC_BACKEND_URL` | no | Publicly reachable base URL shown to admins for webhook configuration (e.g. an ngrok tunnel) |
| `JITSI_BASE_URL` | no (default `https://meet.jit.si`) | Base URL for generated interview meeting links |
| `MEETING_ROOM_PREFIX` | no | Prefix used when slugifying Jitsi room names |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | **yes** for any email feature (OTP, interview emails, decision emails) | Nodemailer transport config |
| `DEFAULT_TIMEZONE` | no (default `Asia/Kolkata`) | Timezone used for interview scheduling windows |
| `OTP_SECRET` | no (falls back to `JWT_SECRET`) | HMAC key for hashing OTP codes |

### `ai-service/.env`

| Variable | Required | Purpose |
|---|---|---|
| `APP_NAME` | no | FastAPI app title |
| `AI_PROVIDER` | **yes**, must be `gemini` | Only Gemini is implemented; any other value raises `GeminiRequestError` |
| `GEMINI_API_KEY` | **yes** | Google Gemini API key |
| `GEMINI_MODEL` | no (default `gemini-1.5-flash`, compose sets `gemini-2.0-flash`) | Primary model |
| `GEMINI_FALLBACK_MODELS` | no (default `gemini-2.5-flash,gemini-2.5-pro,gemini-2.0-flash-lite`) | Comma-separated fallback models tried on quota/rate-limit errors |
| `LLM_TEMPERATURE` | no (default `0.4`) | Default generation temperature |
| `LLM_TIMEOUT_SECONDS` | no (default `45`) | (Reserved; not currently wired to a hard timeout) |
| `CHROMA_HTTP_HOST` / `CHROMA_HOST` | no | ChromaDB host for HTTP client mode (Docker: `chromadb`) |
| `CHROMA_HTTP_PORT` / `CHROMA_PORT` | no (default `8000`) | ChromaDB port |
| `CHROMA_PERSIST_DIRECTORY` | no (default `./chroma_data`) | Local persistence dir when not using HTTP mode, and JSON-fallback vector store location |
| `CHROMA_COLLECTION_NAME` | no (default `knowledge_base_documents`) | Chroma collection name |
| `EMBEDDING_PROVIDER` | no (default `sentence-transformers`) | Falls back to a deterministic hash-based embedding if the model can't load |
| `EMBEDDING_MODEL_NAME` | no (default `all-MiniLM-L6-v2`) | HuggingFace embedding model |

### `frontend/.env`

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | no (default `http://localhost:5000/api`) | Backend API base URL used by Axios |

---

## Running Locally

### Option A — Docker Compose (recommended)

```bash
docker compose up -d --build
```

This starts:
- `chromadb` on `:8001` (mapped from container `:8000`)
- `mongo` on `:27017`
- `ai-service` on `:8000`
- `backend` on `:5000`
- `frontend` (Nginx, static build + `/api/` reverse-proxy to backend) on `:3000`

Verify health:
```bash
curl http://localhost:5000/api/health
curl http://localhost:8000/health
```

### Option B — Run services natively

```bash
# Terminal 1 — MongoDB & ChromaDB (or use docker for just these two)
docker compose up -d mongo chromadb

# Terminal 2 — AI service
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 3 — Backend
cd backend
npm install
npm run dev        # nodemon, auto-restart

# Terminal 4 — Frontend
cd frontend
npm install
npm run dev         # Vite dev server, default port 5173
```

When running natively, set `backend/.env`'s `AI_SERVICE_URL=http://localhost:8000` and ensure `CHROMA_HTTP_HOST`/`MONGO_URI` point at `localhost` instead of the Docker service names.

---

## Build Commands

| Service | Command | Output |
|---|---|---|
| frontend | `npm run build` | Static bundle in `frontend/dist/` (Vite) |
| frontend | `npm run preview` | Serves the built bundle locally |
| backend | `npm start` | Runs `node src/server.js` (no build step; plain CommonJS) |
| ai-service | *(none)* | Pure Python; no build step, runs via `uvicorn` |
| Docker | `docker compose build` | Builds all 3 custom images (`ai-service`, `backend`, `frontend`) |

---

## Deployment Overview

The project ships with a production-ready `docker-compose.yml`:
- `frontend` is built as a static bundle and served by Nginx, which also reverse-proxies `/api/` to the `backend` container — so the frontend needs no CORS configuration in production.
- `backend` and `ai-service` communicate over the Docker network by service name (`ai-service:8000`).
- `mongo` and `chromadb` use named volumes (`mongo-data`, `chroma-data`) for persistence.

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for full details (environment variables, health checks, rollback, troubleshooting).

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `AI service route not found at ...` | ai-service not rebuilt/restarted after a route change | `docker compose up -d --build ai-service` |
| Ranking/interview packets return generic placeholder text (e.g. "No weakness detail returned") | Gemini quota/rate-limit exhausted on the primary model | Confirm `GEMINI_API_KEY` has quota; the app auto-retries across `GEMINI_FALLBACK_MODELS` — verify that list is non-empty and the fallback models are enabled on your Gemini plan |
| `Gemini API key missing` error | `GEMINI_API_KEY` not set in `ai-service/.env` / container env | Set it and restart `ai-service` |
| `JWT_SECRET is not configured` | `backend/.env` missing `JWT_SECRET` | Set it and restart `backend` |
| Login returns 403 `Please verify your email first` | User hasn't completed OTP verification | Call `/api/auth/verify-otp`, or (dev only) flip `isVerified`/`emailVerified` directly in Mongo |
| Email-dependent actions fail with "SMTP_HOST is not configured" | SMTP env vars missing | Set `SMTP_HOST/PORT/USER/PASS/FROM` in `backend/.env` and restart backend |
| `CORS blocked origin` errors in browser console | Frontend origin not in `CLIENT_URL` | Add the origin (comma-separated) to `backend/.env`'s `CLIENT_URL` |
| Resume upload rejected with "Only PDF files are allowed" | Non-PDF file uploaded | Multer's `fileFilter` only accepts `application/pdf`; convert the file or use a PDF |
| `Only PDF files are allowed` uploads > 10MB rejected | Multer `limits.fileSize` is 10MB | Reduce file size |
| ChromaDB unavailable | `chromadb` container down, or `CHROMA_HTTP_HOST` misconfigured for native runs | The ai-service degrades to a local JSON fallback vector store (`chroma_data/fallback_vector_store.json`) automatically; fix connectivity for production-quality retrieval |
| Webhook submissions never appear as candidates | Admin hasn't clicked "Fetch Resumes", or `jobId` hidden field missing from the form | Check `GET /api/external-applications/summary?jobId=...` for `latestWebhook` diagnostics |

---

## Contribution Guidelines

- Read [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) before making changes — it documents folder conventions and where new features belong.
- Keep changes scoped: a bug fix should not bundle unrelated refactors.
- Follow existing patterns exactly:
  - Backend: `routes/` wire `protect` + `authorizeRoles` middleware, delegate to `controllers/`, which use `models/` and `services/`.
  - AI service: each capability (`jd`, `resume`, `ranking`, `interview`, `knowledge`) is a self-contained package with `routes.py`, `schemas.py`, and either a `service.py` or a LangGraph `graph.py` + supporting `context.py`/`prompts.py`/`parser.py`/`validators.py`.
  - Frontend: pages call the backend exclusively through the shared `api` Axios instance (`src/api/axios.js`); do not introduce a second HTTP client.
- Do not commit `.env` files, `backend/uploads/`, or `ai-service/app/**/__pycache__/`.
- When touching AI generation chains, reuse `invoke_chain_with_model_fallback` (`ai-service/app/shared/llm/invoker.py`) rather than calling `get_llm()` directly, so quota/rate-limit errors fail over to the configured fallback models (this is the established pattern already used by JD generation, ranking, and interview generation).
- Run the app locally (or via Docker) and exercise the affected flow end-to-end before submitting — this codebase has no automated test suite, so manual verification is the primary safety net.
