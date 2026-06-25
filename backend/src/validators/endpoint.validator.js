// backend/src/validators/endpoint.validator.js

const { z } = require('zod');

const urlSchema = z
  .string()
  .trim()
  .refine((v) => /^https?:\/\//i.test(v), { message: 'url must start with http:// or https://' });

const retryFields = {
  maxRetries: z.number().int().min(1).max(15).optional(),
  retryBackoffMs: z.number().int().min(1000).max(60000).optional(),
};

const createEndpointSchema = z.object({
  url: urlSchema,
  description: z.string().trim().max(500).optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
  ...retryFields,
});

const updateEndpointSchema = z.object({
  url: urlSchema.optional(),
  description: z.string().trim().max(500).optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional(),
  ...retryFields,
});

const sendTestEventSchema = z.object({
  eventType: z.string().min(1, 'eventType is required'),
  payload: z.any()
});

module.exports = { createEndpointSchema, updateEndpointSchema, sendTestEventSchema };