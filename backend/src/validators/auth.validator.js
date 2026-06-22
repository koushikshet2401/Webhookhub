// backend/src/validators/auth.validator.js

const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  email: z.string().trim().toLowerCase().email('must be a valid email'),
  password: z.string().min(8, 'password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('must be a valid email'),
  password: z.string().min(1, 'password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

module.exports = { registerSchema, loginSchema, refreshSchema };