# WebhookHub — Reliable Event Delivery & Job Processing Platform

Webhook delivery platform (Svix/Hookdeck-style) built on top of a generic
BullMQ-backed job queue engine. The queue engine isn't webhook-specific —
it's the reusable core; webhook delivery is the flagship feature running on it.

## Stack
- **Backend:** Node.js, Express, Prisma + MySQL, Redis + BullMQ, Socket.IO, JWT
- **Frontend:** React + Vite, Tailwind CSS v4, Axios, Socket.IO client, Recharts

## Prerequisites
- Node.js v18+ (v20 LTS recommended)
- MySQL 8+
- Redis 6+

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env         # fill in real DB/Redis/JWT values
npx prisma generate
npx prisma migrate dev --name init   # needs MySQL running
npm run dev                  # http://localhost:6000
```

Verify it's alive:
```bash
curl http://localhost:6000/api/health
```

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env         # point VITE_API_BASE_URL / VITE_SOCKET_URL at your backend
npm run dev                  # http://localhost:5174
```

## What's already built and tested (today's session)

- **`src/utils/signature.js`** — real HMAC-SHA256 signing/verification, Stripe-style
  (`t=<timestamp>,v1=<signature>`), with a replay-protection tolerance window and a
  timing-safe comparison. This is genuinely production-grade, not a stub.
- **`src/queues/webhookQueue.js`** — a working BullMQ queue + worker. The worker
  signs the payload, POSTs it to the endpoint URL, and throws on non-2xx so BullMQ's
  exponential backoff (8 attempts, starting at 5s) automatically retries.
- **End-to-end verified locally**: spun up a fake receiver that validates the HMAC
  signature, enqueued a real delivery job, and confirmed the full chain —
  enqueue → worker → signed HTTP POST → receiver verifies signature → 200 OK.
- **`prisma/schema.prisma`** — full data model: `Project`, `ApiKey`, `Endpoint`,
  `Event`, `Delivery`, `DeliveryAttemptLog` (the webhook domain) plus a generic
  `Job` ledger (the durable system-of-record for the queue engine, since
  Redis/BullMQ state is meant to be ephemeral working memory, not history).
- **Socket.IO** wired up (`src/sockets/index.js`) with a `project_<id>` room
  pattern and an `emitDeliveryUpdate()` helper, ready for the live dashboard.

## What's NOT built yet (next phases)
- Auth/JWT routes, RBAC middleware
- REST API: create projects, register endpoints, ingest events, list deliveries
- Writing delivery results back to MySQL (currently the worker only logs —
  the `TODO` comments in `webhookQueue.js` mark exactly where Prisma writes go)
- Dead-letter handling once attempts are exhausted (currently just logged)
- Frontend dashboard pages (currently default Vite scaffold)
- Load testing + ARCHITECTURE.md write-up (your "10/10" checklist items)

## Folder Structure

```
webhookhub/
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── config/        # db.js (Prisma), redis.js (BullMQ connection)
│   │   ├── controllers/   # (Phase 1+)
│   │   ├── middleware/    # (Phase 1+) auth, validation
│   │   ├── queues/        # webhookQueue.js — Queue + Worker + QueueEvents
│   │   ├── routes/        # health.routes.js + future route files
│   │   ├── services/      # (Phase 1+) project/endpoint/event services
│   │   ├── sockets/        # index.js — Socket.IO, project rooms
│   │   ├── utils/          # signature.js — HMAC sign/verify
│   │   └── server.js
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/ pages/ hooks/ context/   # (Phase 1+, currently empty)
    │   └── services/   # api.js (axios), socket.js (socket.io-client)
    └── .env.example
```

## Suggested next step (Phase 1)
Build `auth` (JWT issue/verify, RBAC) → `projects` + `endpoints` CRUD → wire the
event-ingestion endpoint to call `enqueueDelivery()` → fill in the `TODO`s in
`webhookQueue.js` to persist results to the `Delivery` table → THEN start the
dashboard UI, since it needs real data to render against.
