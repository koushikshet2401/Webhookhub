// backend/src/controllers/endpoint.controller.js

const crypto = require('crypto');
const prisma = require('../config/db');
const { logAction } = require('../utils/audit');
const { encrypt } = require('../utils/crypto');

function generateEndpointSecret() {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

// Strip the secret out of anything we send back to the dashboard - it's only
// ever shown once, at creation, exactly like an API key.
function toPublicEndpoint(endpoint) {
  const { secret, ...rest } = endpoint;
  return { ...rest, eventTypes: JSON.parse(rest.eventTypes) };
}

async function createEndpoint(req, res) {
  const projectId = Number(req.params.projectId);
  const { url, description, eventTypes } = req.body;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const plainSecret = generateEndpointSecret();
  const endpoint = await prisma.endpoint.create({
    data: {
      projectId,
      url,
      description: description || null,
      secret: encrypt(plainSecret), // encrypted at rest with ENV_ENCRYPTION_KEY
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

  return res.status(201).json({
    ...toPublicEndpoint(endpoint),
    secret: plainSecret,
    warning: 'Save this secret now - it will not be shown again. Use it to verify the X-WebhookHub-Signature header.',
  });
}

async function listEndpoints(req, res) {
  const projectId = Number(req.params.projectId);
  const endpoints = await prisma.endpoint.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(endpoints.map(toPublicEndpoint));
}

async function getEndpoint(req, res) {
  const id = Number(req.params.id);
  const endpoint = await prisma.endpoint.findUnique({ where: { id } });
  if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' });
  return res.json(toPublicEndpoint(endpoint));
}

async function updateEndpoint(req, res) {
  const id = Number(req.params.id);
  const { url, description, eventTypes, isActive } = req.body;

  const existing = await prisma.endpoint.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Endpoint not found' });

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

  return res.json(toPublicEndpoint(endpoint));
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