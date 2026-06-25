// backend/src/routes/apiKey.item.routes.js

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { revokeApiKey, regenerateApiKey } = require('../controllers/apiKey.controller');

router.use(requireAuth);
router.use(requireRole('ADMIN', 'DEVELOPER'));

router.patch('/:id/revoke', asyncHandler(revokeApiKey));
router.post('/:id/regenerate', asyncHandler(regenerateApiKey));

module.exports = router;