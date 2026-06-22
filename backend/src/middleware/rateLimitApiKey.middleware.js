// backend/src/middleware/rateLimitApiKey.middleware.js

const redis = require('../config/redis');

// Fixed-window counter, not sliding window or token bucket - the simplest
// correct approach, with one known trade-off worth stating explicitly: a
// client can burst up to 2x the limit across a window boundary (e.g. max
// requests right at 0:59 and again right at 1:00). For per-key abuse
// protection on this endpoint that trade-off is acceptable; a token bucket
// would be the upgrade if smoother enforcement is ever needed.
function rateLimitByApiKey({ windowSeconds = 60, max = 120 } = {}) {
  return async (req, res, next) => {
    if (!req.apiKeyContext) return next(); // must run after requireApiKey

    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `ratelimit:apikey:${req.apiKeyContext.apiKeyId}:${window}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      if (count > max) {
        return res.status(429).json({ error: 'Rate limit exceeded for this API key' });
      }
      next();
    } catch (err) {
      // Fail open: a Redis hiccup should not take down event ingestion
      console.error('[rateLimitByApiKey] redis error, allowing request:', err.message);
      next();
    }
  };
}

module.exports = { rateLimitByApiKey };