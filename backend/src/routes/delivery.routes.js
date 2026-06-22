// backend/src/routes/delivery.routes.js

const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { listDeliveries } = require('../controllers/delivery.controller');

router.use(requireAuth);

router.get('/', asyncHandler(listDeliveries));

module.exports = router;