// backend/src/validators/project.validator.js

const { z } = require('zod');

const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { createProjectSchema, updateProjectSchema };