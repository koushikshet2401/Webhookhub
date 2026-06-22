// backend/src/controllers/delivery.controller.js

const prisma = require('../config/db');
const { enqueueDelivery } = require('../queues/webhookQueue');
const { logAction } = require('../utils/audit');
const { decrypt } = require('../utils/crypto');

async function listDeliveries(req, res) {
  const projectId = Number(req.params.projectId);
  const { status, endpointId, eventType, from, to } = req.query;

  const deliveries = await prisma.delivery.findMany({
    where: {
      endpoint: { projectId },
      ...(status ? { status } : {}),
      ...(endpointId ? { endpointId: Number(endpointId) } : {}),
      ...(eventType ? { event: { eventType } } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { event: true, endpoint: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return res.json(deliveries);
}

async function getDelivery(req, res) {
  const id = Number(req.params.id);
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      event: true,
      endpoint: true,
      attemptLogs: { orderBy: { attemptedAt: 'asc' } },
    },
  });
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  return res.json(delivery);
}

async function replayDelivery(req, res) {
  const id = Number(req.params.id);
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { event: true, endpoint: true },
  });
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  const updated = await prisma.delivery.update({
    where: { id },
    data: { status: 'PENDING', attemptCount: 0, deadLetteredAt: null },
  });

  await enqueueDelivery({
    deliveryId: delivery.id,
    projectId: delivery.endpoint.projectId,
    endpointUrl: delivery.endpoint.url,
    secret: decrypt(delivery.endpoint.secret),
    eventType: delivery.event.eventType,
    payload: JSON.parse(delivery.event.payload),
  });

  await logAction({
    userId: req.user.id,
    action: 'delivery.replay',
    targetType: 'Delivery',
    targetId: id,
  });

  return res.json(updated);
}

module.exports = { listDeliveries, getDelivery, replayDelivery };