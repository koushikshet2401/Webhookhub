// backend/src/routes/endpoint.item.routes.js

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { getEndpoint, updateEndpoint, deleteEndpoint } = require('../controllers/endpoint.controller');

router.use(requireAuth);

router.get('/:id', asyncHandler(getEndpoint));
router.put('/:id', requireRole('ADMIN', 'DEVELOPER'), asyncHandler(updateEndpoint));
router.delete('/:id', requireRole('ADMIN', 'DEVELOPER'), asyncHandler(deleteEndpoint));

module.exports = router;