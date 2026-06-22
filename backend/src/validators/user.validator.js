// backend/src/validators/user.validator.js

const { z } = require('zod');

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'DEVELOPER', 'VIEWER'], {
    errorMap: () => ({ message: 'role must be one of: ADMIN, DEVELOPER, VIEWER' }),
  }),
});

module.exports = { updateRoleSchema };