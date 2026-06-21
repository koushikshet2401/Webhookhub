// backend/src/middleware/apiKeyAuth.middleware.js

const crypto = require('crypto');
const prisma = require('../config/db');
const { hashApiKey, extractPrefix } = require('../utils/apiKey');

// This guards customer-facing API routes (e.g. event ingestion) - separate
// from requireAuth/JWT, which guards the dashboard. A customer's backend
// authenticates with an API key, not a logged-in user session.
async function requireApiKey(req, res, next) {
  const header = req.headers['x-api-key'] || req.headers.authorization || '';
  const rawKey = header.startsWith('Bearer ') ? header.slice(7) : header;

  if (!rawKey) {
    return res.status(401).json({ error: 'Missing API key (use the X-API-Key header)' });
  }

  const prefix = extractPrefix(rawKey);
  if (!prefix) {
    return res.status(401).json({ error: 'Malformed API key' });
  }

  // Why SHA-256 here instead of bcrypt: bcrypt is designed to slow down
  // brute-forcing low-entropy human passwords, and its hashes aren't
  // directly comparable - the only way to "find" a match is to bcrypt.compare
  // against every candidate row, which is O(n) and doesn't scale. An API key
  // already has 192 bits of randomness, so a fast deterministic hash plus an
  // indexed prefix lookup gives the same practical security with O(1) lookup.
  const candidate = await prisma.apiKey.findFirst({
    where: { prefix, revokedAt: null },
  });

  if (!candidate) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  const providedHash = hashApiKey(rawKey);
  const a = Buffer.from(providedHash, 'hex');
  const b = Buffer.from(candidate.keyHash, 'hex');
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  if (candidate.expiresAt && candidate.expiresAt < new Date()) {
    return res.status(401).json({ error: 'API key has expired' });
  }

  // Fire-and-forget usage tracking - never block the request on this write
  prisma.apiKey
    .update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } })
    .catch((err) => console.error('[apiKeyAuth] failed to update lastUsedAt:', err.message));

  req.apiKeyContext = { apiKeyId: candidate.id, projectId: candidate.projectId };
  next();
}

module.exports = { requireApiKey };