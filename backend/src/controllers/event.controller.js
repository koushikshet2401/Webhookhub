// backend/src/controllers/event.controller.js

const prisma = require('../config/db');
const { enqueueDelivery } = require('../queues/webhookQueue');
const { decrypt } = require('../utils/crypto');

async function ingestEvent(req, res) {
  const { projectId } = req.apiKeyContext;
  const { eventType, payload } = req.body;

  const event = await prisma.event.create({
    data: {
      projectId,
      eventType,
      payload: JSON.stringify(payload),
      sourceIp: req.ip,
    },
  });

  const endpoints = await prisma.endpoint.findMany({ where: { projectId, isActive: true } });

  // Fan-out: "*" subscribes to everything, otherwise match the exact event type
  const subscribed = endpoints.filter((e) => {
    const types = JSON.parse(e.eventTypes);
    return types.includes('*') || types.includes(eventType);
  });

  const deliveries = [];
  for (const endpoint of subscribed) {
    const delivery = await prisma.delivery.create({
      data: { eventId: event.id, endpointId: endpoint.id, status: 'PENDING', maxAttempts: endpoint.maxRetries },
    });

    await enqueueDelivery({
      deliveryId: delivery.id,
      projectId,
      endpointUrl: endpoint.url,
      secret: decrypt(endpoint.secret), // decrypted only at the moment it's needed to sign
      eventType,
      payload,
      maxRetries: endpoint.maxRetries,
      retryBackoffMs: endpoint.retryBackoffMs,
    });

    deliveries.push({ deliveryId: delivery.id, endpointId: endpoint.id });
  }

  // 202: the event is accepted and queued, delivery happens asynchronously
  return res.status(202).json({
    eventId: event.id,
    eventType,
    matchedEndpoints: subscribed.length,
    deliveries,
  });
}

module.exports = { ingestEvent };