// backend/src/routes/apiKey.routes.js

const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { createApiKey, listApiKeys } = require('../controllers/apiKey.controller');

router.use(requireAuth);

router.post('/', requireRole('ADMIN', 'DEVELOPER'), asyncHandler(createApiKey));
router.get('/', asyncHandler(listApiKeys));

module.exports = router;