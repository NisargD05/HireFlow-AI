# Deployment Guide

This guide covers deploying the AI Agentic HR System from scratch using the provided Docker Compose configuration (`docker-compose.yml`), which is the only deployment mechanism currently defined in this repository — there is no Kubernetes manifest, Helm chart, or cloud-specific IaC.

## Prerequisites

- Docker Engine + Docker Compose v2 (`docker compose`, not the legacy `docker-compose`)
- A host with network access to:
  - `generativelanguage.googleapis.com` (Google Gemini API)
  - Your SMTP provider (e.g. `smtp.gmail.com:587`)
  - Optionally, the public internet if Tally/Typeform webhooks need to reach this host (see Webhook connectivity below)
- A Google Gemini API key with quota on at least the primary model and ideally the fallback models too (`gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash-lite`)
- SMTP credentials capable of sending transactional email (OTP codes, interview invites, decision notices)
- Persistent volumes/disk for MongoDB data, ChromaDB data, and uploaded files (resumes + knowledge-base PDFs are stored on the backend container's local filesystem, which is **not** volume-mounted in the provided compose file — see the Storage Configuration section)

## Environment Variables

Create the following files before building (none are committed — `backend/.env.example` and `frontend/.env.example` are templates; `ai-service/.env` has no template and must be created manually).

### `backend/.env`

```env
PORT=5000
MONGO_URI=mongodb://mongo:27017/ai_hiring_system
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-frontend-domain.com
AI_SERVICE_URL=http://ai-service:8000

APPLICATION_FORM_PROVIDER=tally
TALLY_FORM_BASE_URL=https://tally.so/r/<your-form-id>
TALLY_FORM_ID=<your-form-id>
WEBHOOK_PUBLIC_BASE_URL=https://your-public-backend-domain.com

JITSI_BASE_URL=https://meet.jit.si
MEETING_ROOM_PREFIX=aihiring

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@yourcompany.com
SMTP_PASS=<app-password>
SMTP_FROM=you@yourcompany.com

DEFAULT_TIMEZONE=Asia/Kolkata
```

### `ai-service/.env`

```env
APP_ENV=docker
RUNNING_IN_DOCKER=true
APP_NAME=AI Hiring JD Service

AI_PROVIDER=gemini
GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-2.0-flash
GEMINI_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.5-pro,gemini-2.0-flash-lite

LLM_TEMPERATURE=0.4
LLM_TIMEOUT_SECONDS=45

CHROMA_HTTP_HOST=chromadb
CHROMA_HTTP_PORT=8000
CHROMA_PERSIST_DIRECTORY=./chroma_data
CHROMA_COLLECTION_NAME=knowledge_base_documents

EMBEDDING_PROVIDER=sentence-transformers
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2
```

### `frontend` build arg / `.env`

The frontend is built with `VITE_API_URL` baked in at build time (Dockerfile `ARG VITE_API_URL=/api`). In the provided compose file this defaults to the relative path `/api`, which Nginx reverse-proxies to the `backend` service — you generally do **not** need to override this in Docker deployments. Only set `frontend/.env`'s `VITE_API_URL` to an absolute URL if you are building the frontend to talk to a backend on a different origin (which would also require adjusting backend CORS via `CLIENT_URL`).

### Compose-level overrides

`docker-compose.yml` additionally sets these directly on the `ai-service` and `backend` services (they override the `.env` files for the values shown):

```yaml
ai-service:
  environment:
    - CHROMA_HTTP_HOST=chromadb
    - CHROMA_HTTP_PORT=8000
    - APP_NAME=AI Hiring JD Service
    - AI_PROVIDER=gemini
    - LLM_TEMPERATURE=0.4
    - LLM_TIMEOUT_SECONDS=45
    - EMBEDDING_PROVIDER=sentence-transformers
    - EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2
backend:
  environment:
    - MONGO_URI=mongodb://mongo:27017/ai_hiring_system
    - PORT=5000
    - JWT_SECRET=${JWT_SECRET:-dev_change_me_to_a_long_random_secret}
    - CLIENT_URL=http://localhost:3000,http://localhost:5173
    - AI_SERVICE_URL=http://ai-service:8000
    - JITSI_BASE_URL=https://meet.jit.si
    - MEETING_ROOM_PREFIX=aihiring
```

**Important**: `JWT_SECRET` defaults to `dev_change_me_to_a_long_random_secret` if the host environment doesn't provide one. For any real deployment, export `JWT_SECRET` in the host shell (or a `.env` file next to `docker-compose.yml`, which Compose auto-loads for variable substitution) before running `docker compose up`:

```bash
export JWT_SECRET=$(openssl rand -hex 32)
docker compose up -d --build
```

Similarly, `CLIENT_URL` is hardcoded to `localhost` origins in the compose file — change it to your real frontend origin(s) for production, and set `GEMINI_API_KEY`/`SMTP_*` via `ai-service/.env` and `backend/.env` (the `env_file:` directives load them) since they aren't overridden inline.

## Production Build

```bash
docker compose build
```

This builds three images:
- `newhiring-ai-service` — `python:3.12-slim` base, installs `requirements.txt`, copies `app/`, runs `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- `newhiring-backend` — `node:18-alpine` base, `npm ci`, copies source, runs `npm start` (`node src/server.js`) — no transpilation/build step, plain CommonJS.
- `newhiring-frontend` — two-stage: `node:20-alpine` builder runs `npm ci && npm run build` (Vite), then copies `dist/` into an `nginx:alpine` runtime stage alongside `nginx.conf`.

`chromadb` (`chromadb/chroma:0.5.23`) and `mongo` (`mongo:7`) are pulled, not built.

## Database Setup

MongoDB requires **no manual schema setup** — Mongoose creates collections and indexes on first write, based on the schemas in `backend/src/models/`. Steps:

1. Ensure the `mongo` service is running and reachable at the `MONGO_URI` configured in `backend/.env`.
2. On first backend startup, `config/db.js` connects via Mongoose; collections are created lazily on first insert.
3. No seed data is required to run the app, but you must create at least one `admin` user via `POST /api/auth/signup` + `POST /api/auth/verify-otp` (or by flipping `isVerified`/`emailVerified` directly in Mongo if SMTP isn't configured yet) before any admin-only endpoint will work.
4. Indexes (unique, compound, text) are declared in the schema files themselves (e.g. `ExternalApplicationSubmission`'s compound unique `(jobId, email)` index, `KnowledgeBaseChunk`'s text index) — Mongoose builds them automatically on connection; no separate migration step exists.

**Backup**: the `mongo-data` named volume holds all persistent data. Back it up with a standard `mongodump`/volume snapshot strategy:
```bash
docker exec ai-hiring-mongo mongodump --db ai_hiring_system --archive=/tmp/backup.archive
docker cp ai-hiring-mongo:/tmp/backup.archive ./backup-$(date +%F).archive
```

## Storage Configuration

There are **two distinct storage concerns** to plan for in a real deployment:

### 1. Vector store (ChromaDB)
- The `chromadb` service uses the named volume `chroma-data` (`docker-compose.yml`), mounted at `/chroma/data` — this persists across container restarts/recreations as long as the volume isn't removed (`docker compose down -v` **would** delete it).
- If ChromaDB is unreachable at any point, the ai-service transparently degrades to a local JSON file at `CHROMA_PERSIST_DIRECTORY/fallback_vector_store.json` **inside the ai-service container**, which is *not* volume-mounted by default — this fallback data is lost on container recreation. For production, ensure `chromadb` has real uptime guarantees rather than relying on the fallback.

### 2. Uploaded files (resumes + knowledge-base PDFs)
- `backend/uploads/resumes/` and `backend/uploads/knowledge-base/` are created on-demand by `uploadMiddleware.js` / `externalApplicationController.js` **inside the backend container's filesystem** — there is **no volume mount for `/app/uploads` in the provided `docker-compose.yml`**. This means uploaded files are lost whenever the `backend` container is recreated (e.g. on every `docker compose up -d --build backend`).
- **For any real deployment, add a persistent volume for uploads** before going live:
  ```yaml
  backend:
    volumes:
      - backend-uploads:/app/uploads
  volumes:
    backend-uploads:
  ```
  Without this, resume files referenced by `CandidateResume.filePath` and knowledge-base PDFs referenced by `KnowledgeBaseDocument.filePath` will 404/ENOENT after any backend redeploy, even though the Mongo metadata records survive.

## Deployment Steps

1. Provision a host with Docker + Docker Compose.
2. Clone the repository.
3. Create `backend/.env`, `ai-service/.env` (see above), and optionally `frontend/.env` (only needed for non-Docker builds or a non-relative API URL).
4. Add the `backend-uploads` volume mount described above (recommended for any real usage beyond a demo).
5. Export `JWT_SECRET` and adjust `CLIENT_URL` in the compose file (or convert those hardcoded `environment:` blocks to reference `.env` values) for your real domain.
6. Build and start:
   ```bash
   docker compose up -d --build
   ```
7. Verify all five containers are `Up`:
   ```bash
   docker compose ps
   ```
8. Run health checks (see below).
9. Create the first admin user (signup + OTP verify, or direct Mongo flip if SMTP isn't ready yet).
10. Log in, upload at least one knowledge-base PDF (ranking requires non-empty KB retrieval — see [AI_WORKFLOW.md](AI_WORKFLOW.md#candidate-ranking-appranking)), create a job, generate + approve a JD, and configure the Tally/Typeform webhook URL shown by `GET /api/external-applications/summary` against your real form.

### Webhook connectivity

Tally/Typeform must be able to reach `POST /api/webhooks/tally` (or `/typeform`) on your **publicly reachable** backend URL. Set `WEBHOOK_PUBLIC_BASE_URL` (or `PUBLIC_BACKEND_URL`) in `backend/.env` to that public URL so the "Fetch Resumes" panel shows the correct webhook URL to configure in the form provider's dashboard. In development, a tunnel (e.g. ngrok) is commonly used for this — the repo's own `backend/.env` example shows a `gambling-dupe-gleeful.ngrok-free.dev` value as a reference for that pattern; replace it with your own tunnel or public domain.

## CI/CD

**There is no CI/CD pipeline defined in this repository** — no `.github/workflows/`, no `Jenkinsfile`, no other pipeline configuration was found. Deployment is manual via `docker compose build && docker compose up -d`. If you introduce CI/CD, the natural steps to automate are:
1. `docker compose build` (or build each image individually and push to a registry)
2. Deploy/restart the updated service(s) on the target host
3. Run the health checks below as a post-deploy smoke test

## Health Checks

| Check | Command | Healthy response |
|---|---|---|
| Backend liveness | `curl http://localhost:5000/api/health` | `{ "status": "ok", "service": "backend", "mongoUriConfigured": true, "jwtConfigured": true, "aiServiceUrl": "..." }` |
| AI service liveness + Chroma connectivity | `curl http://localhost:8000/health` | `{ "status": "ok", "chroma": "connected", "vector_store": "chromadb", "runtime": {...} }` (or `"vector_store": "fallback_json"` if Chroma is down but the JSON fallback has data) |
| AI service root | `curl http://localhost:8000/` | `{ "message": "AI Hiring JD Service is running", "runtime": {...} }` |
| Frontend | `curl -I http://localhost:3000/` | `200 OK` from Nginx |
| Container status | `docker compose ps` | All 5 services `Up` (or `Up (healthy)` if you add healthchecks — none are defined in the current compose file) |
| MongoDB | `docker exec ai-hiring-mongo mongosh --eval "db.adminCommand('ping')"` | `{ ok: 1 }` |

None of the services in `docker-compose.yml` currently define a `healthcheck:` block or `depends_on: condition: service_healthy` — `depends_on` only controls start **order**, not readiness. If the `mongo` or `chromadb` containers are slow to accept connections, `backend`/`ai-service` may log transient connection errors on their very first requests; both reconnect automatically on the next request (Mongoose auto-reconnects; the ai-service's Chroma client and fallback logic tolerate transient failures).

## Monitoring

There is no metrics/monitoring stack configured in this repository (no Prometheus, no APM agent). Current observability is log-based only:
- **Backend**: `utils/logger.js` prints structured JSON-ish log lines (`[timestamp] [LEVEL] message {metadata}`) to stdout — capture via `docker compose logs backend` or redirect to your log aggregator of choice.
- **AI service**: uvicorn's access logs plus ad-hoc `print`/exception traces surface via `docker compose logs ai-service`.
- **Application-level audit trail**: `AIJobGenerationLog` (JD generation attempts/failures) and `WebhookDebugEvent` (every webhook delivery, success or failure) are queryable directly in MongoDB and give you a persistent record beyond container log retention — useful for auditing AI usage and webhook reliability without an external monitoring stack.

If you add monitoring, the most valuable signals given this architecture are: Gemini `429`/quota error rate (surfaces as `is_quota_or_rate_limit_error` matches in ai-service logs), ChromaDB fallback activation (`"vector_store": "fallback_json"` in `/health`), and SMTP delivery failures (`EmailDeliveryError` in backend logs).

## Rollback Strategy

Since there is no CI/CD or image registry configured, rollback is manual:

1. **Code rollback**: `git checkout <previous-tag-or-commit>` then rebuild and restart the affected service(s):
   ```bash
   docker compose up -d --build backend ai-service frontend
   ```
2. **Data rollback**: MongoDB has no automatic migration/versioning, so schema changes are additive by convention (new fields with defaults) — a code rollback is generally safe against newer data, since older code simply ignores fields it doesn't know about. If a rollback needs to undo a genuinely destructive data change, restore from your `mongodump` backup:
   ```bash
   docker cp ./backup-<date>.archive ai-hiring-mongo:/tmp/backup.archive
   docker exec ai-hiring-mongo mongorestore --archive=/tmp/backup.archive --drop
   ```
3. **Partial rollback of a single service**: since `backend`, `ai-service`, and `frontend` are independently built/tagged images, you can roll back just one:
   ```bash
   docker compose up -d --build ai-service   # e.g. if only the AI logic regressed
   ```
4. **ChromaDB/embedding rollback**: if a bad knowledge-base document was indexed, delete it via `DELETE /api/knowledge-base/:id` (removes the Mongo metadata + chunk rows) — note this does **not** currently remove the corresponding vectors from ChromaDB itself, so for a full rollback of vector data you may need to reset the `chroma-data` volume and re-upload all knowledge-base documents.

## Troubleshooting Deployment Issues

| Symptom | Cause | Resolution |
|---|---|---|
| `backend` container exits immediately | `MONGO_URI` unreachable or malformed | Check `docker compose logs backend`; verify `mongo` is up and `MONGO_URI` matches the service name/port |
| `ai-service` returns 500 on every AI call | `GEMINI_API_KEY` missing/invalid | `docker exec ai-service env \| grep GEMINI`; set the key in `ai-service/.env` and `docker compose up -d --build ai-service` |
| Frontend loads but all API calls fail with CORS errors | `CLIENT_URL` doesn't include the frontend's actual origin | Update `backend/.env`'s `CLIENT_URL` (comma-separated list) and restart `backend` |
| Resume/knowledge-base files disappear after a redeploy | No volume mounted for `backend/uploads` (see Storage Configuration) | Add a named volume for `/app/uploads` in `docker-compose.yml` before any production use |
| Ranking always returns score 0 / generic text | Either the knowledge base is empty (ranking requires ≥1 retrievable chunk — see [AI_WORKFLOW.md](AI_WORKFLOW.md)), or Gemini quota is exhausted across all fallback models | Upload at least one knowledge-base PDF; check ai-service logs for `ResourceExhausted` and verify `GEMINI_FALLBACK_MODELS` models are enabled on your plan |
| Webhook submissions never appear | `WEBHOOK_PUBLIC_BASE_URL` not publicly reachable, or the form's hidden `jobId` field isn't configured | Confirm the URL from `GET /api/external-applications/summary` is reachable from the public internet; inspect `WebhookDebugEvent` records for the actual delivered payload |
| `docker compose up` succeeds but `chromadb` never becomes queryable | Chroma image version mismatch with the `chromadb` Python client pinned in `requirements.txt` (`chromadb==0.5.23`) | Keep the Chroma server image tag (`chromadb/chroma:0.5.23`) in sync with the Python client version |
| Emails never send, no error surfaced to the end user in some flows | `SMTP_HOST` unset — `otpEmailService`/`emailService` throw explicit errors, but double-check the specific endpoint's error handling surfaces it (most do, as a `502`) | `docker compose logs backend \| grep "Email Service"`; verify all 5 SMTP variables are set |
