// backend/src/utils/apiKey.js

const crypto = require('crypto');

const KEY_PREFIX = 'whsk';

function generateApiKey() {
  const secret = crypto.randomBytes(24).toString('hex'); // 192 bits of entropy
  const fullKey = `${KEY_PREFIX}_${secret}`;
  const prefix = secret.slice(0, 8); // safe to store/display, not a secret by itself
  const keyHash = hashApiKey(fullKey);
  return { fullKey, prefix, keyHash };
}

function hashApiKey(fullKey) {
  // SHA-256, not bcrypt - see note in apiKeyAuth.middleware.js for why.
  return crypto.createHash('sha256').update(fullKey).digest('hex');
}

function extractPrefix(fullKey) {
  // fullKey looks like "whsk_<48 hex chars>"
  const parts = fullKey.split('_');
  if (parts.length !== 2 || parts[0] !== KEY_PREFIX) return null;
  return parts[1].slice(0, 8);
}

module.exports = { generateApiKey, hashApiKey, extractPrefix, KEY_PREFIX };