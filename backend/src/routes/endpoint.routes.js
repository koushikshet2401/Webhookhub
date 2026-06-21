// backend/src/routes/endpoint.routes.js

const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { createEndpoint, listEndpoints } = require('../controllers/endpoint.controller');

router.use(requireAuth);

router.post('/', requireRole('ADMIN', 'DEVELOPER'), asyncHandler(createEndpoint));
router.get('/', asyncHandler(listEndpoints));

module.exports = router;