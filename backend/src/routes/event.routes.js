// backend/src/routes/event.routes.js

const express = require('express');
const router = express.Router();
const { requireApiKey } = require('../middleware/apiKeyAuth.middleware');
const { rateLimitByApiKey } = require('../middleware/rateLimitApiKey.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate.middleware');
const { ingestEventSchema } = require('../validators/event.validator');
const { ingestEvent } = require('../controllers/event.controller');

router.post(
  '/',
  requireApiKey,
  rateLimitByApiKey({ windowSeconds: 60, max: 120 }),
  idempotency,
  validate(ingestEventSchema),
  asyncHandler(ingestEvent)
);

module.exports = router;