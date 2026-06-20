# WebhookHub

A self-hosted webhook delivery and event infrastructure platform. Reliably delivers events to customer endpoints with signed payloads, automatic retries with exponential backoff, dead-letter handling, and a real-time delivery dashboard.

## Architecture

- **Frontend:** React 18 with Vite, TailwindCSS v4
- **Backend:** Node.js with Express.js
- **Database:** MySQL 8+ (managed via Prisma ORM)
- **Queue Engine:** Redis + BullMQ (delivery jobs, retries, exponential backoff)
- **Real-Time:** Socket.IO for live delivery status updates
- **Authentication:** JWT with bcrypt password hashing
- **Security:** HMAC-SHA256 payload signing (Stripe-style `t=<timestamp>,v1=<signature>`, with replay protection)

## Features

### Webhook Delivery Engine
- **Endpoint Management:** register, update, enable/disable destination URLs per project
- **Signed Payloads:** every outgoing event signed with HMAC-SHA256, verifiable by the receiver
- **Automatic Retries:** exponential backoff (5s up to ~10min, 8 attempts) on non-2xx responses or timeouts
- **Dead Letter Queue:** permanently failed deliveries stay visible for manual replay — nothing silently vanishes
- **Delivery Logs:** every attempt recorded with response code, latency, and error detail

### Queue & Job Engine
- Generic background job processing on Redis + BullMQ — built so other job types can run on the same engine, not just webhook delivery
- Durable job ledger in MySQL as the system-of-record once Redis evicts completed/expired jobs

### Real-Time Dashboard
- Live delivery status updates via Socket.IO, scoped per project room
- *(Planned)* live request/response feed, endpoint health view, analytics charts

### Team & Project Management
- **Role-Based Access:** Admin, Developer, Viewer roles with distinct permissions
- **API Key Management:** generate, revoke, regenerate keys per project, with expiration support

## Setup Instructions

### Prerequisites
- Node.js 18+
- MySQL 8+
- Redis 6+

### 1. Database Setup
```bash
mysql -u root -p
CREATE DATABASE webhookhub_db;
exit;
```

### 2. Backend Setup

Navigate to the backend directory and install dependencies:
```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:
```env
# Server
PORT=6000
NODE_ENV=development
FRONTEND_URL=http://localhost:5174

# Database
DATABASE_URL="mysql://root:password@localhost:3306/webhookhub_db"

# Authentication
JWT_SECRET=your_super_secret_key

# Redis / Queue
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Generate the Prisma client and run migrations:
```bash
npx prisma generate
npx prisma migrate deploy
```

Start the backend server:
```bash
npm start
```
The API will be available at `http://localhost:6000/api`

### 3. Frontend Setup

Navigate to the frontend directory:
```bash
cd frontend
npm install
```

Create a `.env` file in the frontend directory:
```env
VITE_API_BASE_URL=http://localhost:6000/api
VITE_SOCKET_URL=http://localhost:6000
VITE_APP_NAME=WebhookHub
```

Run the frontend development server:
```bash
npm run dev
```

## Signing & Delivery Configuration (.env)

> [!NOTE]
> **Test Mode:** If you don't have a real receiver to test against yet, point an endpoint at a tool like [webhook.site](https://webhook.site), or spin up a tiny local HTTP server that echoes the `X-WebhookHub-Signature` header — this is exactly how the queue/worker pipeline was verified during development, with no real customer endpoint involved.

```env
# Signature tolerance window (seconds) - rejects replayed/old signed requests
SIGNATURE_TOLERANCE_SECONDS=300

# Encrypts endpoint secrets at rest (exactly 32 characters)
ENV_ENCRYPTION_KEY=your_32_character_key
```

Each Endpoint gets its own signing secret, generated when the endpoint is created. Receivers verify the `X-WebhookHub-Signature` header using that secret — see `backend/src/utils/signature.js` for the exact algorithm.

## How Delivery & Retries Work

Unlike a plain HTTP call, WebhookHub treats every delivery as a queued job:

1. An event is ingested via the API and fanned out into one `Delivery` per subscribed endpoint.
2. Each delivery is enqueued onto the BullMQ `webhook-deliveries` queue.
3. The worker signs the payload and POSTs it to the endpoint.
4. A non-2xx response or timeout throws, and BullMQ automatically retries with exponential backoff (8 attempts).
5. If all attempts are exhausted, the delivery is marked dead-lettered and stays visible for manual replay.

## Production Deployment

### 1. Database Migration
When pushing new code to production, never reset the database. Always use:
```bash
npx prisma migrate deploy
```

### 2. Build Frontend
```bash
cd frontend
npm run build
```

### 3. Process Manager (PM2)
```bash
npm install -g pm2
cd backend
pm2 start src/server.js --name "webhookhub-api"
```

### 4. Nginx Reverse Proxy & SSL
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve Frontend Static Build
    location / {
        root /path/to/frontend/dist;
        try_files $uri /index.html;
    }

    # Route API to Node.js Backend
    location /api/ {
        proxy_pass http://localhost:6000/api/;
    }
}
```
Run `sudo certbot --nginx -d yourdomain.com` to enable HTTPS.

## Project Structure

```
webhookhub/
├── backend/
│   ├── prisma/                  # schema.prisma - Project, Endpoint, Event, Delivery, Job, etc.
│   ├── src/
│   │   ├── config/              # db.js (Prisma), redis.js (BullMQ connection)
│   │   ├── controllers/         # (in progress)
│   │   ├── middleware/          # (in progress) JWT auth, RBAC
│   │   ├── queues/              # webhookQueue.js - Queue + Worker + retry/backoff
│   │   ├── routes/              # health.routes.js + (in progress)
│   │   ├── services/            # (in progress)
│   │   ├── sockets/             # Socket.IO real-time delivery updates
│   │   ├── utils/               # signature.js - HMAC sign/verify
│   │   └── server.js            # Express entry point
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/ pages/ hooks/ context/   # (in progress)
    │   └── services/             # api.js (axios), socket.js
    └── package.json
```

