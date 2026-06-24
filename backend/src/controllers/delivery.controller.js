// backend/src/controllers/delivery.controller.js

const prisma = require('../config/db');
const { enqueueDelivery } = require('../queues/webhookQueue');
const { logAction } = require('../utils/audit');
const { decrypt } = require('../utils/crypto');

// Same rule as endpoint.controller.js: the endpoint secret is shown once,
// at creation, and never again - including when it rides along as an
// included relation on a Delivery. Easy to miss exactly because it's a
// different code path reaching the same underlying row.
function sanitizeDelivery(delivery) {
  if (!delivery || !delivery.endpoint) return delivery;
  const { secret, ...endpointWithoutSecret } = delivery.endpoint;
  return { ...delivery, endpoint: endpointWithoutSecret };
}

// Shared by both single and bulk replay - resets a delivery's state and
// re-enqueues it through the exact same worker path a fresh delivery would
// take, using whatever retry config currently applies to the endpoint (not
// necessarily what was configured when the delivery originally failed).
async function replayOneDelivery(delivery) {
  const updated = await prisma.delivery.update({
    where: { id: delivery.id },
    data: { status: 'PENDING', attemptCount: 0, deadLetteredAt: null },
  });

  await enqueueDelivery({
    deliveryId: delivery.id,
    projectId: delivery.endpoint.projectId,
    endpointUrl: delivery.endpoint.url,
    secret: decrypt(delivery.endpoint.secret),
    eventType: delivery.event.eventType,
    payload: JSON.parse(delivery.event.payload),
    maxRetries: delivery.endpoint.maxRetries,
    retryBackoffMs: delivery.endpoint.retryBackoffMs,
  });

  return updated;
}

async function listDeliveries(req, res) {
  const projectId = Number(req.params.projectId);
  const { status, endpointId, eventType, from, to } = req.query;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

  const where = {
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
  };

  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      include: { event: true, endpoint: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.delivery.count({ where }),
  ]);

  return res.json({
    data: deliveries.map(sanitizeDelivery),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
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
  return res.json(sanitizeDelivery(delivery));
}

async function replayDelivery(req, res) {
  const id = Number(req.params.id);
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { event: true, endpoint: true },
  });
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  const updated = await replayOneDelivery(delivery);

  await logAction({
    userId: req.user.id,
    action: 'delivery.replay',
    targetType: 'Delivery',
    targetId: id,
  });

  return res.json(updated);
}

/**
 * Replays every DEAD_LETTERED delivery for one endpoint in a single call -
 * e.g. after fixing a bug on the receiving end, you shouldn't have to click
 * "replay" on 200 individual deliveries one at a time.
 */
async function replayFailedForEndpoint(req, res) {
  const endpointId = Number(req.params.id);

  const deadLettered = await prisma.delivery.findMany({
    where: { endpointId, status: 'DEAD_LETTERED' },
    include: { event: true, endpoint: true },
  });

  const replayedIds = [];
  for (const delivery of deadLettered) {
    await replayOneDelivery(delivery);
    replayedIds.push(delivery.id);
  }

  await logAction({
    userId: req.user.id,
    action: 'delivery.bulk_replay',
    targetType: 'Endpoint',
    targetId: endpointId,
    metadata: { count: replayedIds.length },
  });

  return res.json({ replayedCount: replayedIds.length, deliveryIds: replayedIds });
}

module.exports = { listDeliveries, getDelivery, replayDelivery, replayFailedForEndpoint };