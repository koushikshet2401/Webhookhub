// backend/src/server.js

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const userRoutes = require('./routes/user.routes');
const apiKeyRoutes = require('./routes/apiKey.routes');
const apiKeyItemRoutes = require('./routes/apiKey.item.routes');
const endpointRoutes = require('./routes/endpoint.routes');
const endpointItemRoutes = require('./routes/endpoint.item.routes');
const { initSocket } = require('./sockets');
require('./queues/webhookQueue'); // boots the queue + worker + queueEvents listeners

const app = express();
const server = http.createServer(app);

// ---- Core middleware ----
app.use(helmet());
app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(cookieParser());
app.use(express.json());

// ---- Basic rate limiting ----
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
});
app.use(limiter);

// ---- Routes ----
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects/:projectId/api-keys', apiKeyRoutes);
app.use('/api/api-keys', apiKeyItemRoutes);
app.use('/api/projects/:projectId/endpoints', endpointRoutes);
app.use('/api/endpoints', endpointItemRoutes);

app.get('/', (req, res) => {
  res.send('WebhookHub backend is running.');
});

// ---- Global error handler (must come after all routes) ----
app.use((err, req, res, next) => {
  console.error('[error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ---- Socket.IO ----
initSocket(server);

// ---- Start server ----
const PORT = process.env.PORT || 6000;
server.listen(PORT, () => {
  console.log(`WebhookHub backend listening on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = { app, server };