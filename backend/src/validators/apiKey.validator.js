// backend/src/validators/apiKey.validator.js

const { z } = require('zod');

const createApiKeySchema = z.object({
  label: z.string().trim().max(100).optional(),
  expiresAt: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(Date.parse(v)), { message: 'expiresAt must be a valid date string' }),
});

module.exports = { createApiKeySchema };