require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const healthRoutes = require('./routes/health.routes');
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

app.get('/', (req, res) => {
  res.send('WebhookHub backend is running.');
});

// ---- Socket.IO ----
initSocket(server);

// ---- Start server ----
const PORT = process.env.PORT || 6000;
server.listen(PORT, () => {
  console.log(`WebhookHub backend listening on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = { app, server };
