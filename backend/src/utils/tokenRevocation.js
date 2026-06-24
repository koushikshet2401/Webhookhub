// backend/src/utils/tokenRevocation.js

const crypto = require('crypto');
const redis = require('../config/redis');

const REVOKED_JTI_PREFIX = 'revoked_jti:';
const TOKEN_GEN_PREFIX = 'token_gen:';
const RESET_TOKEN_PREFIX = 'password_reset:';

/**
 * Marks a token's jti as revoked until its natural expiry. The TTL matches
 * the token's remaining lifetime exactly - no point storing a revocation
 * entry for longer than the token itself would have been valid anyway.
 */
async function revokeToken(jti, expiresAtUnixSeconds) {
  const ttlSeconds = Math.max(1, expiresAtUnixSeconds - Math.floor(Date.now() / 1000));
  await redis.set(`${REVOKED_JTI_PREFIX}${jti}`, '1', 'EX', ttlSeconds);
}

async function isTokenRevoked(jti) {
  if (!jti) return false;
  try {
    const result = await redis.get(`${REVOKED_JTI_PREFIX}${jti}`);
    return result !== null;
  } catch (err) {
    // Fail open on a Redis hiccup - rejecting every authenticated request
    // because Redis blinked is a worse outcome than a brief revocation gap.
    console.error('[tokenRevocation] redis error, treating as not-revoked:', err.message);
    return false;
  }
}

/**
 * Returns the user's current token "generation" (defaults to 0 if never
 * incremented). Every access token embeds the generation that was current
 * when it was minted; requireAuth rejects any token whose embedded
 * generation doesn't match the CURRENT one.
 *
 * This exists instead of comparing timestamps deliberately: JWT `iat` only
 * has whole-second precision, so a revocation and a fresh login happening
 * in the same wall-clock second are indistinguishable by timestamp alone -
 * which would either let a just-revoked token slip through, or reject a
 * brand new token issued moments after the reset. A discrete counter has no
 * such ambiguity: a token is either from the current generation or it isn't.
 */
async function getUserTokenGeneration(userId) {
  try {
    const gen = await redis.get(`${TOKEN_GEN_PREFIX}${userId}`);
    return gen ? Number(gen) : 0;
  } catch (err) {
    console.error('[tokenRevocation] redis error reading generation, defaulting to 0:', err.message);
    return 0;
  }
}

/**
 * Bumps the user's token generation - used on password reset. Every token
 * minted before this call (regardless of its iat) is now stale, and every
 * token minted after this call (even in the same second) correctly embeds
 * the new generation and remains valid.
 */
async function bumpUserTokenGeneration(userId) {
  await redis.incr(`${TOKEN_GEN_PREFIX}${userId}`);
}

/**
 * Issues a password reset token. Only the SHA-256 hash is stored (same
 * reasoning as API keys - this is a high-entropy random value, not a
 * human password, so a fast hash plus a short TTL is the right tool).
 * Returns the raw token, which goes in the emailed link and is never
 * stored anywhere.
 */
async function createPasswordResetToken(userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await redis.set(`${RESET_TOKEN_PREFIX}${hash}`, String(userId), 'EX', 60 * 60); // 1 hour
  return rawToken;
}

/**
 * Consumes a password reset token - looks it up and deletes it in one shot
 * (single use). Returns the userId it belonged to, or null if invalid/expired.
 */
async function consumePasswordResetToken(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const key = `${RESET_TOKEN_PREFIX}${hash}`;
  const userId = await redis.get(key);
  if (!userId) return null;
  await redis.del(key);
  return Number(userId);
}

module.exports = {
  revokeToken,
  isTokenRevoked,
  getUserTokenGeneration,
  bumpUserTokenGeneration,
  createPasswordResetToken,
  consumePasswordResetToken,
};