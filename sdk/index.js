// sdk/index.js

const crypto = require('crypto');

/**
 * Verifies a WebhookHub signature against the raw request body.
 *
 * IMPORTANT: rawBody must be the exact bytes WebhookHub sent - not
 * JSON.stringify(req.body). Re-serializing JSON can change key order or
 * whitespace even for a semantically identical object, and HMAC is computed
 * over exact bytes, not parsed structure. If you're using Express with
 * express.json() already mounted, the raw body is gone by the time your
 * route handler runs - use webhookhubReceiver() below instead, which
 * captures it before any body parser touches the request.
 */
function verifySignature(secret, rawBody, signatureHeader, toleranceSeconds = 300) {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=')));
  const timestamp = Number(parts.t);
  const providedSig = parts.v1;
  if (!timestamp || !providedSig) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > toleranceSeconds) return false;

  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(providedSig, 'hex');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

/**
 * Express middleware that captures the raw body and verifies the
 * X-WebhookHub-Signature header before your route handler runs.
 *
 * Mount this BEFORE express.json() on your webhook route specifically -
 * if express.json() (or any other body parser) runs first, the raw stream
 * is already consumed and this middleware will never see it.
 *
 *   const { webhookhubReceiver } = require('webhookhub-verify');
 *   app.post('/webhooks/incoming', webhookhubReceiver(process.env.WEBHOOK_SECRET), (req, res) => {
 *     console.log(req.body); // already verified and parsed
 *     res.sendStatus(200);
 *   });
 */
function webhookhubReceiver(secret, options = {}) {
  return (req, res, next) => {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      const signatureHeader = req.headers['x-webhookhub-signature'];
      const valid = verifySignature(secret, rawBody, signatureHeader, options.toleranceSeconds);

      if (!valid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      try {
        req.body = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
      req.rawBody = rawBody;
      next();
    });
    req.on('error', next);
  };
}

module.exports = { verifySignature, webhookhubReceiver };