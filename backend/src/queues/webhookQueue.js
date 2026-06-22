// backend/src/queues/webhookQueue.js

const { Queue, Worker, QueueEvents } = require('bullmq');
const axios = require('axios');
const connection = require('../config/redis');
const prisma = require('../config/db');
const { signPayload } = require('../utils/signature');
const { emitDeliveryUpdate } = require('../sockets');

const QUEUE_NAME = process.env.DELIVERY_QUEUE_NAME || 'webhook-deliveries';

const deliveryQueue = new Queue(QUEUE_NAME, { connection });

function stringifyResponseBody(data) {
  if (data === undefined || data === null) return null;
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return str.slice(0, 2000); // don't let a huge response body blow up the row
}

/**
 * Enqueue a delivery attempt for one (event, endpoint) pair.
 * Retry/backoff is handled by BullMQ - exponential backoff starting at 5s,
 * capped at 8 attempts before the job is considered dead-lettered.
 */
async function enqueueDelivery({ deliveryId, projectId, endpointUrl, secret, eventType, payload }, opts = {}) {
  return deliveryQueue.add(
    'deliver',
    { deliveryId, projectId, endpointUrl, secret, eventType, payload },
    {
      attempts: 8,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 3600 }, // keep 1hr in Redis, MySQL Delivery row is the durable record
      removeOnFail: false, // keep failed jobs visible until explicitly handled/replayed
      ...opts, // test-only override hook (e.g. lower attempts/delay) - never used in production calls
    }
  );
}

// ---- Worker: actually performs the HTTP delivery and persists the result ----
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { deliveryId, projectId, endpointUrl, secret, eventType, payload } = job.data;
    const rawBody = JSON.stringify(payload);
    const { header } = signPayload(secret, rawBody);
    const attemptNumber = job.attemptsMade + 1;

    const startedAt = Date.now();
    let response = null;
    let errorMessage = null;

    try {
      response = await axios.post(endpointUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-WebhookHub-Signature': header,
          'X-WebhookHub-Event': eventType,
        },
        timeout: 10000,
        validateStatus: () => true, // inspect non-2xx ourselves instead of axios throwing
      });
    } catch (err) {
      errorMessage = err.message; // network error, timeout, DNS failure, etc.
    }

    const latencyMs = Date.now() - startedAt;
    const statusCode = response ? response.status : null;
    const success = response && response.status >= 200 && response.status < 300;
    const responseBody = response ? stringifyResponseBody(response.data) : null;

    // Every attempt gets its own log row - this is the audit trail a
    // dashboard or support engineer would actually want to read.
    await prisma.deliveryAttemptLog.create({
      data: {
        deliveryId,
        attemptNumber,
        responseStatusCode: statusCode,
        responseBody,
        errorMessage,
        durationMs: latencyMs,
      },
    });

    if (success) {
      await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status: 'SUCCESS',
          attemptCount: attemptNumber,
          lastAttemptAt: new Date(),
          responseStatusCode: statusCode,
          responseBody,
          latencyMs,
        },
      });
      emitDeliveryUpdate(projectId, { deliveryId, status: 'SUCCESS', attemptNumber, latencyMs });
      return { success: true, status: statusCode, latencyMs };
    }

    // Not successful yet - record this attempt's outcome. Whether this is
    // truly "dead" (no attempts left) is decided in the queueEvents 'failed'
    // handler below, since only BullMQ knows the configured attempts ceiling.
    await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: 'DELIVERING',
        attemptCount: attemptNumber,
        lastAttemptAt: new Date(),
        responseStatusCode: statusCode,
        responseBody,
      },
    });
    emitDeliveryUpdate(projectId, { deliveryId, status: 'DELIVERING', attemptNumber, statusCode });

    throw new Error(errorMessage || `Endpoint responded with status ${statusCode}`);
  },
  { connection, concurrency: 5 }
);

worker.on('error', (err) => {
  // BullMQ Worker is an EventEmitter - an unhandled 'error' event crashes
  // the whole Node process, so this listener is not optional.
  console.error('[queue worker] error:', err.message);
});

const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

queueEvents.on('error', (err) => {
  console.error('[queue events] error:', err.message);
});

queueEvents.on('completed', ({ jobId }) => {
  console.log(`[queue] delivery job ${jobId} succeeded`);
});

queueEvents.on('failed', async ({ jobId, failedReason }) => {
  console.log(`[queue] delivery job ${jobId} attempt failed: ${failedReason}`);
  try {
    const job = await deliveryQueue.getJob(jobId);
    if (!job) return;

    const maxAttempts = job.opts.attempts || 1;
    const exhausted = job.attemptsMade >= maxAttempts;
    if (!exhausted) return; // BullMQ will still retry this one

    const { deliveryId, projectId } = job.data;
    await prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: 'DEAD_LETTERED', deadLetteredAt: new Date() },
    });
    emitDeliveryUpdate(projectId, { deliveryId, status: 'DEAD_LETTERED' });
    console.log(`[queue] delivery ${deliveryId} dead-lettered after ${job.attemptsMade} attempts`);
  } catch (err) {
    console.error('[queue] failed to process dead-letter check:', err.message);
  }
});

module.exports = { deliveryQueue, enqueueDelivery, worker, queueEvents };