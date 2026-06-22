// backend/src/validators/endpoint.validator.js

const { z } = require('zod');

const urlSchema = z
  .string()
  .trim()
  .refine((v) => /^https?:\/\//i.test(v), { message: 'url must start with http:// or https://' });

const createEndpointSchema = z.object({
  url: urlSchema,
  description: z.string().trim().max(500).optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
});

const updateEndpointSchema = z.object({
  url: urlSchema.optional(),
  description: z.string().trim().max(500).optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { createEndpointSchema, updateEndpointSchema };