// backend/src/routes/project.routes.js

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate.middleware');
const { createProjectSchema, updateProjectSchema } = require('../validators/project.validator');
const {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
} = require('../controllers/project.controller');

router.use(requireAuth);

// Admin, Developer, and Viewer can all view projects
router.get('/', asyncHandler(listProjects));
router.get('/:id', asyncHandler(getProject));

// Only Admin manages project lifecycle
router.post('/', requireRole('ADMIN'), validate(createProjectSchema), asyncHandler(createProject));
router.put('/:id', requireRole('ADMIN'), validate(updateProjectSchema), asyncHandler(updateProject));
router.delete('/:id', requireRole('ADMIN'), asyncHandler(deleteProject));

module.exports = router;