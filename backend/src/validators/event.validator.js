// backend/src/validators/event.validator.js

const { z } = require('zod');

const ingestEventSchema = z.object({
  eventType: z.string().trim().min(1, 'eventType is required'),
  payload: z.unknown().refine((v) => v !== undefined, { message: 'payload is required' }),
});

module.exports = { ingestEventSchema };