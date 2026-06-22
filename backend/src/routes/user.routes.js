// backend/src/routes/user.routes.js

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate.middleware');
const { updateRoleSchema } = require('../validators/user.validator');
const { listUsers, updateUserRole } = require('../controllers/user.controller');

router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.get('/', asyncHandler(listUsers));
router.patch('/:id/role', validate(updateRoleSchema), asyncHandler(updateUserRole));

module.exports = router;