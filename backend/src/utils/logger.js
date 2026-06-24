// backend/src/utils/logger.js

// Lightweight structured logger - JSON lines with level, timestamp, message,
// and arbitrary metadata (notably reqId, when called from request context).
// Not a replacement for a real log aggregator if this ever runs multi-instance,
// but it's the difference between "grep-able" and "scroll through console.log
// soup" for a single-instance deployment.

function log(level, message, meta = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
};