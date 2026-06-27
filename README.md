# WebhookHub

A self-hosted webhook delivery platform — like a reliable courier service for
apps talking to each other. When one system needs to tell another "this just
happened," WebhookHub guarantees that message actually arrives: signed
payloads, automatic retries with exponential backoff, dead-letter handling
for permanently failed deliveries, manual replay, and a real-time dashboard
to watch it all happen.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Local Installation](#local-installation)
- [Environment Variables](#environment-variables)
- [Deployment Guide (Render + Vercel + Clever Cloud)](#deployment-guide-render--vercel--clever-cloud)
- [How to Use the Web Application](#how-to-use-the-web-application)
- [How to Test End-to-End](#how-to-test-end-to-end)
- [API Reference](#api-reference)
- [Security Features](#security-features)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Features

- **Reliable delivery engine** — exponential-backoff retries (default 8
  attempts, 5s → ~21min), automatic dead-lettering, one-click manual replay
  (single delivery or bulk "replay all failed" per endpoint)
- **Per-endpoint retry configuration** — override the default attempt count
  and backoff delay independently for each registered endpoint
- **Real-time dashboard** — Socket.IO-powered live delivery status updates,
  no manual refresh needed
- **Multi-tenant projects** — each project has its own endpoints, API keys,
  and isolated delivery history
- **Role-based access control** — Admin / Developer / Viewer, enforced
  identically on both the API and the dashboard UI
- **Security-hardened by default**:
  - SSRF protection blocking private/loopback/cloud-metadata IP ranges,
    checked at both registration time and again at delivery time (closes a
    DNS-rebinding gap a single check would miss)
  - AES-256-GCM encryption for endpoint secrets at rest
  - SHA-256-hashed API keys (not bcrypt — see `ARCHITECTURE.md`)
  - HMAC-SHA256 payload signing with replay protection
  - Per-API-key rate limiting, independent of the global IP rate limit
  - Idempotency-key support on event ingestion
- **Full audit trail** — every attempt logged with status code, latency,
  and response body; every admin action logged separately
- **Email flows** — password reset and email verification, with a built-in
  console-logging fallback when no SMTP provider is configured (no mail
  server required for local development)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | MySQL 8+ (via Prisma ORM) |
| Queue | Redis + BullMQ |
| Real-time | Socket.IO |
| Frontend | React 18 + Vite, Tailwind CSS v4 |
| Auth | JWT (access + refresh) with bcrypt password hashing |

**This project's own deployment** runs on:
- **Backend** → [Render](https://render.com)
- **Frontend** → [Vercel](https://vercel.com)
- **Database** → [Clever Cloud](https://clever-cloud.com) (MySQL)
- **Redis** → any managed Redis provider supporting ACL username/password
  auth (the connection config auto-detects TLS for any non-localhost host)

## Prerequisites

- Node.js 18+
- MySQL 8+ (local, or a managed instance like Clever Cloud)
- Redis 6+ (local, or a managed instance)

## Local Installation

```bash
git clone <this-repo-url>
cd webhookhub

# Backend
cd backend
npm install
cp .env.example .env        # fill in real values - see table below
npx prisma generate
npx prisma migrate dev --name init
npm run dev                  # http://localhost:6000

# Frontend (new terminal)
cd ../frontend
npm install
cp .env.example .env
npm run dev                  # http://localhost:5174
```

Verify the backend is alive: `curl http://localhost:6000/api/health`

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No | Defaults to `6000` |
| `NODE_ENV` | Yes | `development` or `production` — controls whether error responses leak stack traces |
| `FRONTEND_URL` | Yes | Used to build links inside emails (password reset, verification) |
| `ALLOWED_ORIGINS` | Yes | Comma-separated list of origins allowed by CORS |
| `DATABASE_URL` | Yes | `mysql://user:pass@host:port/dbname` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Yes | Long random strings — **must differ** from each other and from any value used elsewhere |
| `ACCESS_TOKEN_EXPIRES_IN` | No | Defaults to `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | Defaults to `30d` |
| `ENV_ENCRYPTION_KEY` | Yes | **Exactly 32 characters** — encrypts endpoint secrets at rest. Generate with `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"` |
| `REDIS_HOST` / `REDIS_PORT` | Yes | TLS is auto-enabled for any host other than `127.0.0.1`/`localhost` |
| `REDIS_USERNAME` | No | Required by some managed Redis providers using ACL auth; defaults to `default` |
| `REDIS_PASSWORD` | Usually | Required by most managed Redis providers |
| `DELIVERY_QUEUE_NAME` | No | Defaults to `webhook-deliveries` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | No | Global IP-based rate limit (separate from the per-API-key limit on event ingestion) |
| `MAX_REQUEST_BODY_SIZE` | No | Defaults to `512kb` |
| `SMTP_HOST` | No | **Leave unset for dev mode** — emails are logged to the console instead of sent. Only set this once you have working, tested SMTP credentials (see Troubleshooting) |
| `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Conditional | Only used if `SMTP_HOST` is set |
| `EMAIL_FROM` | No | Defaults to a placeholder address |

### Frontend (`frontend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | e.g. `https://your-backend.onrender.com/api` |
| `VITE_SOCKET_URL` | Yes | Same host as above, without the `/api` suffix |

## Deployment Guide (Render + Vercel + Clever Cloud)

### 1. Database — Clever Cloud

Create a MySQL add-on, then run the migration against it **once**, from your
local machine, using the production `DATABASE_URL`:

```bash
DATABASE_URL="mysql://your-clever-cloud-url" npx prisma migrate deploy
```

`migrate deploy` (not `migrate dev`) is the correct command for an existing
production database — it applies pending migrations without prompting or
generating new ones.

### 2. Backend — Render

- New Web Service → connect this repo
- **Root Directory: `backend`** (the repo has both `backend/` and
  `frontend/` at the top level — Render needs to know which one to build)
- Build command: `npm install && npx prisma generate`
- Start command: `npm start`
- Add every backend environment variable from the table above
- **Leave `SMTP_HOST` unset initially** until you've confirmed everything
  else works — see Troubleshooting for why this matters

⚠️ **Free tier note:** Render's free instances spin down after inactivity.
The first request after a period of idleness can take 50+ seconds while it
wakes back up — this is expected, not a bug.

### 3. Frontend — Vercel

- New Project → connect this repo
- **Root Directory: `frontend`**
- Add `VITE_API_BASE_URL` and `VITE_SOCKET_URL`, pointed at your Render
  backend URL
- Once deployed, add the resulting Vercel URL to the backend's
  `ALLOWED_ORIGINS` on Render and redeploy the backend

### 4. Redis

Any managed Redis instance works. Set `REDIS_HOST`, `REDIS_PORT`,
`REDIS_USERNAME` (if your provider uses ACL auth), and `REDIS_PASSWORD`.
TLS is enabled automatically for any non-localhost host — no separate flag
needed.

## How to Use the Web Application

Once deployed (or running locally), here's the actual end-to-end flow:

1. **Register.** The first account created becomes `ADMIN` automatically.
   Every account after that defaults to `DEVELOPER` — an admin can promote
   someone to `VIEWER` or `ADMIN` later from the **Team** page.
2. **Create a project.** Each project is an isolated container — its own
   endpoints, API keys, and delivery history. Think of a project as "one
   app I'm integrating."
3. **Register an endpoint** (Project → Endpoints → New endpoint). This is
   the URL that should receive events — must be a real public URL; private
   IPs, `localhost`, and cloud metadata addresses are rejected on purpose
   (SSRF protection). The signing secret is shown exactly once at creation
   — copy it immediately if you intend to verify signatures on the
   receiving end.
4. **Create an API key** (Project → API keys → New API key). This is the
   credential a sending application uses to call the ingestion API — shown
   once, never retrievable again. Revoke or regenerate any time.
5. **Send a real event.** This is normally done by your own backend code
   the instant something real happens (an order, a payment, a signup) —
   not by a human clicking a button. To test it manually:
   ```bash
   curl -X POST https://your-backend-url/api/events \
     -H "Content-Type: application/json" \
     -H "X-API-Key: YOUR_API_KEY" \
     -d '{"eventType":"order.created","payload":{"orderId":123}}'
   ```
6. **Watch the Deliveries tab.** A new row appears and updates live — no
   refresh needed — as the system attempts delivery, retries on failure,
   and either succeeds or eventually dead-letters.
7. **Replay a failed delivery.** Click into any `DEAD_LETTERED` row and hit
   Replay — it resets and re-attempts delivery through the exact same
   pipeline a fresh event would use.

## How to Test End-to-End

### The fastest way to see a real failure-and-recovery cycle

Get a free disposable receiver URL from **https://webhook.site** — register
it as an endpoint, send an event, confirm it shows up there and in your
Deliveries tab as `SUCCESS`. Then, on webhook.site, use **Edit → Default
Status Code** to set it to `500`, and send another event. Watch the
Deliveries tab: attempts climb, status sits at `DELIVERING`, and it
eventually reaches `DEAD_LETTERED` once retries are exhausted — then hit
Replay to close the loop.

To see this complete in seconds instead of ~21 minutes, set a faster retry
policy when creating the endpoint (or via `PUT /api/endpoints/:id`):
```json
{ "maxRetries": 3, "retryBackoffMs": 2000 }
```

### Windows / PowerShell note

PowerShell's built-in `curl` is actually an alias for `Invoke-WebRequest`
and does not accept real curl syntax. Either call the real binary
explicitly (`curl.exe ...`) or use PowerShell's native equivalent:

```powershell
Invoke-RestMethod -Uri "https://your-backend-url/api/events" -Method Post `
  -Headers @{ "X-API-Key" = "YOUR_API_KEY" } `
  -ContentType "application/json" `
  -Body '{"eventType":"order.created","payload":{"orderId":123}}'
```

Always use **single quotes** around the JSON body in PowerShell — escaped
double quotes are frequently mangled when PowerShell hands the string to an
external program.

### Automated backend tests

```bash
cd backend
npm test
```

Covers signature verification, JWT/token revocation, API key hashing,
encryption, RBAC, SSRF boundary cases, and the queue worker's retry/dead-
letter logic directly (mocked network calls, no real HTTP requests).

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account (first user becomes Admin) |
| POST | `/api/auth/login` | — | Returns access + refresh tokens |
| POST | `/api/auth/refresh` | — | Exchange refresh token for a new access token |
| POST | `/api/auth/logout` | JWT | Revokes the current access token immediately |
| POST | `/api/auth/forgot-password` / `/reset-password` | — | Password recovery flow |
| GET/POST/PUT/DELETE | `/api/projects` | JWT | Project CRUD |
| GET/POST | `/api/projects/:id/endpoints` | JWT | Endpoint CRUD |
| POST | `/api/endpoints/:id/ping` | JWT | Send a connectivity test directly, bypassing the queue |
| POST | `/api/endpoints/:id/regenerate-secret` | JWT | Rotate an endpoint's signing secret |
| POST | `/api/endpoints/:id/replay-failed` | JWT | Bulk-replay every dead-lettered delivery for one endpoint |
| GET/POST | `/api/projects/:id/api-keys` | JWT | API key management |
| **POST** | **`/api/events`** | **API key** | **Event ingestion — the actual production entry point** |
| GET | `/api/projects/:id/deliveries` | JWT | Paginated, filterable delivery list |
| GET | `/api/deliveries/:id` | JWT | Full delivery detail with attempt history |
| POST | `/api/deliveries/:id/replay` | JWT | Replay a single delivery |

Note the auth split: dashboard actions use a **JWT** (the logged-in user's
session); sending real events uses an **API key** instead, scoped to one
project. A leaked API key can send events — it cannot manage projects,
endpoints, or users.

## Security Features

See `ARCHITECTURE.md` for the full reasoning behind each of these, written
specifically to be re-readable months later, not just at build time:
- SSRF protection, checked twice (registration + delivery), specifically to
  defend against DNS rebinding
- AES-256-GCM encryption for secrets at rest
- SHA-256 (not bcrypt) for API key hashing, and why that's the correct
  choice for high-entropy random keys rather than human passwords
- A discrete token-generation counter for session revocation, instead of
  timestamp comparison, to eliminate a same-second race condition found
  during testing

## Project Structure

```
webhookhub/
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── config/        # db.js (Prisma), redis.js (TLS/ACL-aware)
│   │   ├── controllers/   ├── middleware/   ├── routes/
│   │   ├── queues/        # webhookQueue.js - the delivery worker
│   │   ├── utils/         # signature, encryption, jwt, mailer, etc.
│   │   └── server.js
│   ├── test/               # automated test suite
│   └── scripts/             # smoke-test.sh, loadtest.js
├── frontend/
│   └── src/
│       ├── components/   ├── pages/   ├── services/   └── context/
├── sdk/                   # signature-verification helper for receivers
├── ARCHITECTURE.md         # design decisions and trade-offs
└── TESTING.md               # full pre-deployment test plan
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| First request after idle time takes ~50s+ | Render free-tier cold start | Expected behavior, not a bug — wait it out, or upgrade the instance |
| Registration hangs for ~1-2 minutes then errors, but the account works on a subsequent login attempt | `SMTP_HOST` is set to an unreachable/misconfigured mail server, and the email send blocks the response | Unset `SMTP_HOST` to fall back to console-logged dev-mode email, or fix the SMTP credentials |
| `curl` commands fail with parameter-binding errors on Windows | PowerShell's `curl` is aliased to `Invoke-WebRequest`, not real curl | Use `curl.exe` explicitly, or switch to `Invoke-RestMethod` (see examples above) |
| Frontend can't reach the backend at all (network errors in browser console) | `ALLOWED_ORIGINS` on the backend doesn't include the real frontend URL | Add the exact Vercel URL (no trailing slash) to `ALLOWED_ORIGINS` and redeploy the backend |
| Endpoint creation rejected with a 400 | SSRF protection — the URL resolves to a private/loopback/cloud-metadata address | Use a real public URL; this is a security feature working correctly, not a bug |
| `npx prisma migrate dev` fails against a production database | Wrong command — `migrate dev` is for local development only | Use `npx prisma migrate deploy` against any already-provisioned database |