// backend/src/controllers/apiKey.controller.js

const prisma = require('../config/db');
const { generateApiKey } = require('../utils/apiKey');
const { logAction } = require('../utils/audit');

async function createApiKey(req, res) {
  const projectId = Number(req.params.projectId);
  const { label, expiresAt } = req.body;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { fullKey, prefix, keyHash } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      projectId,
      prefix,
      keyHash,
      label: label || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  await logAction({
    userId: req.user.id,
    action: 'apikey.create',
    targetType: 'ApiKey',
    targetId: apiKey.id,
    metadata: { projectId },
  });

  // fullKey is shown exactly once - it can never be recovered after this response
  return res.status(201).json({
    id: apiKey.id,
    label: apiKey.label,
    prefix: apiKey.prefix,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
    key: fullKey,
    warning: 'Save this key now - it will not be shown again.',
  });
}

async function listApiKeys(req, res) {
  const projectId = Number(req.params.projectId);
  const keys = await prisma.apiKey.findMany({
    where: { projectId },
    select: {
      id: true,
      label: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(keys);
}

async function revokeApiKey(req, res) {
  const id = Number(req.params.id);
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) return res.status(404).json({ error: 'API key not found' });
  if (key.revokedAt) return res.status(400).json({ error: 'API key is already revoked' });

  const updated = await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  await logAction({ userId: req.user.id, action: 'apikey.revoke', targetType: 'ApiKey', targetId: id });

  return res.json({ id: updated.id, revokedAt: updated.revokedAt });
}

async function regenerateApiKey(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.apiKey.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'API key not found' });

  // Revoke the old key and mint a brand new credential - never reuse or
  // "update in place" a key's secret, always rotate to a fresh one.
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });

  const { fullKey, prefix, keyHash } = generateApiKey();
  const newKey = await prisma.apiKey.create({
    data: {
      projectId: existing.projectId,
      prefix,
      keyHash,
      label: existing.label,
      expiresAt: existing.expiresAt,
    },
  });

  await logAction({
    userId: req.user.id,
    action: 'apikey.regenerate',
    targetType: 'ApiKey',
    targetId: newKey.id,
    metadata: { replacedKeyId: id },
  });

  return res.status(201).json({
    id: newKey.id,
    label: newKey.label,
    prefix: newKey.prefix,
    expiresAt: newKey.expiresAt,
    createdAt: newKey.createdAt,
    key: fullKey,
    warning: 'Save this key now - it will not be shown again. The previous key has been revoked.',
  });
}

module.exports = { createApiKey, listApiKeys, revokeApiKey, regenerateApiKey };