// backend/src/middleware/idempotency.middleware.js

const redis = require('../config/redis');

const PREFIX = 'idempotency:';
const TTL_SECONDS = 60 * 60 * 24; // 24h - long enough to cover any realistic client retry window

/**
 * Opt-in idempotency for event ingestion. A client that sends the same
 * Idempotency-Key twice (e.g. retrying after their own request timed out,
 * even though the server actually processed it) gets back the exact same
 * response the second time, instead of a second event + a second full
 * round of deliveries.
 *
 * Scoped per API key, not globally - the same idempotency key string used
 * by two different customers/projects is not the same request.
 *
 * Known residual gap: there's a small race window if two requests with the
 * same key arrive genuinely concurrently (both could pass the cache-miss
 * check before either finishes processing). This covers the realistic case
 * - a client retrying sequentially after a timeout - not a true distributed
 * lock. Closing that fully would need a Redis SETNX-based claim step, which
 * is a reasonable next hardening pass if this ever matters in practice.
 */
async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key || !req.apiKeyContext) return next();

  const redisKey = `${PREFIX}${req.apiKeyContext.apiKeyId}:${key}`;

  try {
    const cached = await redis.get(redisKey);
    if (cached) {
      const { status, body } = JSON.parse(cached);
      return res.status(status).json(body);
    }
  } catch (err) {
    console.error('[idempotency] redis error on read, proceeding without cache:', err.message);
  }

  // Intercept the real response once the controller actually produces one,
  // and cache it - this has to wrap res.json rather than run after next(),
  // since Express doesn't give middleware a hook into "the response that
  // already went out."
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    redis
      .set(redisKey, JSON.stringify({ status: res.statusCode, body }), 'EX', TTL_SECONDS)
      .catch((err) => console.error('[idempotency] redis error on write:', err.message));
    return originalJson(body);
  };

  next();
}

module.exports = { idempotency };