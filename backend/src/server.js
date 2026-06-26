// backend/src/server.js

require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const prisma = require('./config/db');
const redisConnection = require('./config/redis');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const userRoutes = require('./routes/user.routes');
const apiKeyRoutes = require('./routes/apiKey.routes');
const apiKeyItemRoutes = require('./routes/apiKey.item.routes');
const endpointRoutes = require('./routes/endpoint.routes');
const endpointItemRoutes = require('./routes/endpoint.item.routes');
const eventRoutes = require('./routes/event.routes');
const deliveryRoutes = require('./routes/delivery.routes');
const deliveryItemRoutes = require('./routes/delivery.item.routes');
const { initSocket } = require('./sockets');
const { worker, deliveryQueue, queueEvents } = require('./queues/webhookQueue'); // boots the queue + worker + queueEvents listeners

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);

// ---- Request ID (for structured logging / tracing a request through logs) ----
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// ---- Core middleware ----
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(s => s.trim().replace(/\/$/, ''))
        .filter(Boolean);
      
      // Add default known origins to prevent lockouts
      allowedOrigins.push('http://localhost:5174');
      allowedOrigins.push('https://webhookhub-rho.vercel.app');

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`[cors] Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(cookieParser());
app.use(express.json({ limit: process.env.MAX_REQUEST_BODY_SIZE || '512kb' }));

// ---- Request Timeout ----
// Prevents infinite spinners if the database silently drops connections
app.use((req, res, next) => {
  req.setTimeout(15000, () => {
    const err = new Error('Request Timeout: The server took too long to respond (likely a database connection issue).');
    err.status = 503;
    next(err);
  });
  next();
});

// ---- Basic rate limiting ----
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
});
app.use((req, res, next) => {
  if (req.path.startsWith('/api/events')) {
    return next();
  }
  return limiter(req, res, next);
});

// ---- Routes ----
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects/:projectId/api-keys', apiKeyRoutes);
app.use('/api/api-keys', apiKeyItemRoutes);
app.use('/api/projects/:projectId/endpoints', endpointRoutes);
app.use('/api/endpoints', endpointItemRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/projects/:projectId/deliveries', deliveryRoutes);
app.use('/api/deliveries', deliveryItemRoutes);

app.get('/', (req, res) => {
  res.send('WebhookHub backend is running.');
});

// ---- Global error handler (must come after all routes) ----
app.use((err, req, res, next) => {
  logger.error('Unhandled request error', { reqId: req.id, error: err.message, stack: err.stack });
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ---- Socket.IO ----
initSocket(server);

// ---- Start server ----
const PORT = process.env.PORT || 4000;
server.listen(PORT, async () => {
  logger.info('WebhookHub backend listening', { port: PORT, env: process.env.NODE_ENV });
  console.log(`[server] Running on port ${PORT}`);
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[database] connected');
  } catch (err) {
    console.error('[database] connection failed:', err.message);
  }
});

// ---- Graceful shutdown ----
// Order matters: stop taking new HTTP work first, then stop the worker from
// picking up new jobs (waiting for any in-flight job to actually finish -
// this is the step that protects a delivery that's mid-attempt during a
// deploy), then close the queue-side connections, then the DB, then the
// raw Redis connection shared by the rate limiter and token revocation.
// A force-exit timeout exists so a stuck shutdown can't hang a deploy
// forever - graceful is the goal, not a guarantee.
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutdown initiated', { signal });

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);

  try {
    await new Promise((resolve) => server.close(resolve));
    logger.info('HTTP server closed');

    await worker.close();
    logger.info('Queue worker closed');

    await queueEvents.close();
    await deliveryQueue.close();
    logger.info('Queue connections closed');

    await prisma.$disconnect();
    logger.info('Database connection closed');

    redisConnection.quit();
    logger.info('Redis connection closed');

    clearTimeout(forceExitTimer);
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };