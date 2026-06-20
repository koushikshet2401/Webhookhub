const crypto = require('crypto');

/**
 * Signs a payload the same way Stripe/Svix do:
 *   signature = HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 * Including the timestamp in the signed string lets receivers reject
 * replayed requests that are older than a tolerance window.
 */
function signPayload(secret, rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const signedContent = `${timestamp}.${rawBody}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('hex');

  return {
    timestamp,
    signature,
    header: `t=${timestamp},v1=${signature}`,
  };
}

/**
 * Verifies an inbound signature header against the raw body + secret.
 * Uses a timing-safe comparison to avoid leaking info via response timing.
 * toleranceSeconds guards against replay attacks using an old, valid signature.
 */
function verifySignature(secret, rawBody, signatureHeader, toleranceSeconds = 300) {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('='))
  );
  const timestamp = Number(parts.t);
  const providedSig = parts.v1;
  if (!timestamp || !providedSig) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > toleranceSeconds) return false;

  const expected = signPayload(secret, rawBody, timestamp).signature;

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(providedSig, 'hex');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

module.exports = { signPayload, verifySignature };
