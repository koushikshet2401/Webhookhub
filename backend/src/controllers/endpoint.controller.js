// backend/src/controllers/endpoint.controller.js

const crypto = require('crypto');
const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

function generateEndpointSecret() {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

async function createEndpoint(req, res) {
  const projectId = Number(req.params.projectId);
  const { url, description, eventTypes } = req.body;

  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'A valid http(s) url is required' });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const secret = generateEndpointSecret();
  const endpoint = await prisma.endpoint.create({
    data: {
      projectId,
      url,
      description: description || null,
      secret, // TODO (Section 5): encrypt at rest with ENV_ENCRYPTION_KEY
      eventTypes: JSON.stringify(eventTypes && eventTypes.length ? eventTypes : ['*']),
    },
  });

  await logAction({
    userId: req.user.id,
    action: 'endpoint.create',
    targetType: 'Endpoint',
    targetId: endpoint.id,
    metadata: { projectId },
  });

  return res.status(201).json({ ...endpoint, eventTypes: JSON.parse(endpoint.eventTypes) });
}

async function listEndpoints(req, res) {
  const projectId = Number(req.params.projectId);
  const endpoints = await prisma.endpoint.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(endpoints.map((e) => ({ ...e, eventTypes: JSON.parse(e.eventTypes) })));
}

async function getEndpoint(req, res) {
  const id = Number(req.params.id);
  const endpoint = await prisma.endpoint.findUnique({ where: { id } });
  if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' });
  return res.json({ ...endpoint, eventTypes: JSON.parse(endpoint.eventTypes) });
}

async function updateEndpoint(req, res) {
  const id = Number(req.params.id);
  const { url, description, eventTypes, isActive } = req.body;

  const existing = await prisma.endpoint.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Endpoint not found' });

  if (url && !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'A valid http(s) url is required' });
  }

  const endpoint = await prisma.endpoint.update({
    where: { id },
    data: {
      ...(url !== undefined ? { url } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(eventTypes !== undefined ? { eventTypes: JSON.stringify(eventTypes) } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  await logAction({
    userId: req.user.id,
    action: 'endpoint.update',
    targetType: 'Endpoint',
    targetId: id,
    metadata: req.body,
  });

  return res.json({ ...endpoint, eventTypes: JSON.parse(endpoint.eventTypes) });
}

async function deleteEndpoint(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.endpoint.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Endpoint not found' });

  await prisma.endpoint.delete({ where: { id } });
  await logAction({ userId: req.user.id, action: 'endpoint.delete', targetType: 'Endpoint', targetId: id });

  return res.status(204).send();
}

module.exports = { createEndpoint, listEndpoints, getEndpoint, updateEndpoint, deleteEndpoint };