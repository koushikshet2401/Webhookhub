// backend/src/utils/emailVerification.js

const crypto = require('crypto');
const redis = require('../config/redis');

const PREFIX = 'email_verify:';
const TTL_SECONDS = 60 * 60 * 24; // 24h - more lenient than the 1h password reset window,
// since "verify your email" is lower-stakes than "someone is trying to take over this account"

async function createEmailVerificationToken(userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await redis.set(`${PREFIX}${hash}`, String(userId), 'EX', TTL_SECONDS);
  return rawToken;
}

async function consumeEmailVerificationToken(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const key = `${PREFIX}${hash}`;
  const userId = await redis.get(key);
  if (!userId) return null;
  await redis.del(key);
  return Number(userId);
}

module.exports = { createEmailVerificationToken, consumeEmailVerificationToken };