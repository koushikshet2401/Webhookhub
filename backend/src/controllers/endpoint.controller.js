// backend/src/controllers/endpoint.controller.js

const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../config/db');
const { logAction } = require('../utils/audit');
const { encrypt, decrypt } = require('../utils/crypto');
const { assertPublicUrl } = require('../utils/urlSafety');
const { signPayload } = require('../utils/signature');

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
  const { url, description, eventTypes, maxRetries, retryBackoffMs } = req.body;

  try {
    await assertPublicUrl(url);
  } catch (err) {
    return res.status(400).json({ error: `Invalid endpoint url: ${err.message}` });
  }

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
      ...(maxRetries !== undefined ? { maxRetries } : {}),
      ...(retryBackoffMs !== undefined ? { retryBackoffMs } : {}),
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
  const { url, description, eventTypes, isActive, maxRetries, retryBackoffMs } = req.body;

  const existing = await prisma.endpoint.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Endpoint not found' });

  if (url !== undefined) {
    try {
      await assertPublicUrl(url);
    } catch (err) {
      return res.status(400).json({ error: `Invalid endpoint url: ${err.message}` });
    }
  }

  const endpoint = await prisma.endpoint.update({
    where: { id },
    data: {
      ...(url !== undefined ? { url } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(eventTypes !== undefined ? { eventTypes: JSON.stringify(eventTypes) } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(maxRetries !== undefined ? { maxRetries } : {}),
      ...(retryBackoffMs !== undefined ? { retryBackoffMs } : {}),
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

async function regenerateEndpointSecret(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.endpoint.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Endpoint not found' });

  // Same pattern as API key regeneration: mint a fresh secret rather than
  // "decrypt and re-encrypt the same value" - if the old one leaked, the
  // whole point is that it should stop being valid.
  const newSecret = generateEndpointSecret();
  const endpoint = await prisma.endpoint.update({
    where: { id },
    data: { secret: encrypt(newSecret) },
  });

  await logAction({ userId: req.user.id, action: 'endpoint.regenerate_secret', targetType: 'Endpoint', targetId: id });

  return res.json({
    ...toPublicEndpoint(endpoint),
    secret: newSecret,
    warning: 'Save this secret now - it will not be shown again. The previous secret no longer works.',
  });
}

async function pingEndpoint(req, res) {
  const id = Number(req.params.id);
  const endpoint = await prisma.endpoint.findUnique({ where: { id } });
  if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' });

  // Re-check even though it passed at creation time - same DNS-rebinding
  // reasoning as the worker's pre-delivery check.
  try {
    await assertPublicUrl(endpoint.url);
  } catch (err) {
    return res.status(400).json({ error: `Endpoint URL is no longer safe to call: ${err.message}` });
  }

  const payload = { message: 'This is a test ping from WebhookHub', timestamp: new Date().toISOString() };
  const rawBody = JSON.stringify(payload);
  const { header } = signPayload(decrypt(endpoint.secret), rawBody);

  const startedAt = Date.now();
  try {
    const response = await axios.post(endpoint.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-WebhookHub-Signature': header,
        'X-WebhookHub-Event': 'webhookhub.ping',
      },
      timeout: 10000,
      validateStatus: () => true,
    });
    const latencyMs = Date.now() - startedAt;

    await logAction({
      userId: req.user.id,
      action: 'endpoint.ping',
      targetType: 'Endpoint',
      targetId: id,
      metadata: { statusCode: response.status, latencyMs },
    });

    return res.json({
      reachable: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      latencyMs,
      responseBody: typeof response.data === 'string' ? response.data.slice(0, 1000) : JSON.stringify(response.data).slice(0, 1000),
    });
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    await logAction({
      userId: req.user.id,
      action: 'endpoint.ping',
      targetType: 'Endpoint',
      targetId: id,
      metadata: { error: err.message, latencyMs },
    });
    return res.json({ reachable: false, error: err.message, latencyMs });
  }
}

module.exports = {
  createEndpoint,
  listEndpoints,
  getEndpoint,
  updateEndpoint,
  deleteEndpoint,
  regenerateEndpointSecret,
  pingEndpoint,
};