// backend/src/controllers/project.controller.js

const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

async function createProject(req, res) {
  const { name } = req.body;

  const project = await prisma.project.create({ data: { name } });
  await logAction({ userId: req.user.id, action: 'project.create', targetType: 'Project', targetId: project.id });

  return res.status(201).json(project);
}

async function listProjects(req, res) {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
  return res.json(projects);
}

async function getProject(req, res) {
  const id = Number(req.params.id);
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  return res.json(project);
}

async function updateProject(req, res) {
  const id = Number(req.params.id);
  const { name, isActive } = req.body;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  await logAction({ userId: req.user.id, action: 'project.update', targetType: 'Project', targetId: id, metadata: req.body });
  return res.json(project);
}

async function deleteProject(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  await prisma.project.delete({ where: { id } });
  await logAction({ userId: req.user.id, action: 'project.delete', targetType: 'Project', targetId: id });

  return res.status(204).send();
}

module.exports = { createProject, listProjects, getProject, updateProject, deleteProject };