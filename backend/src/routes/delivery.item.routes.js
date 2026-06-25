// backend/src/routes/delivery.item.routes.js

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { getDelivery, replayDelivery } = require('../controllers/delivery.controller');

router.use(requireAuth);

router.get('/:id', asyncHandler(getDelivery));
router.post('/:id/replay', requireRole('ADMIN', 'DEVELOPER'), asyncHandler(replayDelivery));

module.exports = router;