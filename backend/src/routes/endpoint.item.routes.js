// backend/src/routes/endpoint.item.routes.js

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate.middleware');
const { updateEndpointSchema, sendTestEventSchema } = require('../validators/endpoint.validator');
const {
  getEndpoint,
  updateEndpoint,
  deleteEndpoint,
  regenerateEndpointSecret,
  pingEndpoint,
  sendTestEvent,
} = require('../controllers/endpoint.controller');
const { replayFailedForEndpoint } = require('../controllers/delivery.controller');

router.use(requireAuth);

router.get('/:id', asyncHandler(getEndpoint));
router.put('/:id', requireRole('ADMIN', 'DEVELOPER'), validate(updateEndpointSchema), asyncHandler(updateEndpoint));
router.delete('/:id', requireRole('ADMIN', 'DEVELOPER'), asyncHandler(deleteEndpoint));
router.post('/:id/regenerate-secret', requireRole('ADMIN', 'DEVELOPER'), asyncHandler(regenerateEndpointSecret));
router.post('/:id/ping', requireRole('ADMIN', 'DEVELOPER'), asyncHandler(pingEndpoint));
router.post('/:id/send-test-event', requireRole('ADMIN', 'DEVELOPER'), validate(sendTestEventSchema), asyncHandler(sendTestEvent));
router.post('/:id/replay-failed', requireRole('ADMIN', 'DEVELOPER'), asyncHandler(replayFailedForEndpoint));

module.exports = router;