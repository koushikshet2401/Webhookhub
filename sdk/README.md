# webhookhub-verify

Signature verification for anyone receiving webhooks from WebhookHub. Two ways to use it, depending on your setup.

## Install

This isn't published to npm - copy `index.js` into your project, or install from this folder directly:

```bash
npm install /path/to/webhookhub/sdk
```

## Option 1: Express middleware (recommended)

Handles raw-body capture and verification for you. Mount it before `express.json()` on this specific route - if a body parser runs first, the raw bytes needed for verification are already gone.

```javascript
const express = require('express');
const { webhookhubReceiver } = require('webhookhub-verify');

const app = express();

app.post('/webhooks/incoming', webhookhubReceiver(process.env.WEBHOOK_SECRET), (req, res) => {
  // req.body is already verified and parsed here
  console.log(req.body);
  res.sendStatus(200);
});
```

## Option 2: Manual verification

Use this if you're not on Express, or already have your own raw-body handling.

```javascript
const { verifySignature } = require('webhookhub-verify');

// rawBody MUST be the exact bytes received - not JSON.stringify(parsedBody).
// Re-serializing JSON can change key order or whitespace even for a
// semantically identical object, and the signature is computed over exact
// bytes, not parsed structure.
const valid = verifySignature(
  process.env.WEBHOOK_SECRET,
  rawBody,
  req.headers['x-webhookhub-signature']
);

if (!valid) {
  return res.status(401).send('Invalid signature');
}
```

## How the signature works

`X-WebhookHub-Signature` looks like `t=1719000000,v1=<hex>`. The signed
content is `${timestamp}.${rawBody}`, HMAC-SHA256'd with your endpoint's
secret. The timestamp is checked against a tolerance window (default 300
seconds) to reject replayed requests - this is the same scheme Stripe uses.

## Idempotency

WebhookHub retries failed deliveries, which means you may receive the
same event more than once - this is normal, not a bug (at-least-once
delivery, not exactly-once - see WebhookHub's ARCHITECTURE.md for why).
Store the event's `eventId` from the payload and skip processing if you've
already seen it.
