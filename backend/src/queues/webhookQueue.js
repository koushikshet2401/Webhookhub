// backend/src/queues/webhookQueue.js

const { Queue, Worker, QueueEvents } = require('bullmq');
const axios = require('axios');
const connection = require('../config/redis');
const prisma = require('../config/db');
const { signPayload } = require('../utils/signature');
const { emitDeliveryUpdate } = require('../sockets');
const { assertPublicUrl } = require('../utils/urlSafety');
const logger = require('../utils/logger');

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
 * capped at 8 attempts before the job is considered dead-lettered (both
 * configurable per-endpoint; these are just the defaults).
 */
async function enqueueDelivery(
  { deliveryId, projectId, endpointUrl, secret, eventType, payload, maxRetries = 8, retryBackoffMs = 5000 },
  opts = {}
) {
  return deliveryQueue.add(
    'deliver',
    { deliveryId, projectId, endpointUrl, secret, eventType, payload },
    {
      attempts: maxRetries,
      backoff: { type: 'exponential', delay: retryBackoffMs },
      removeOnComplete: { age: 3600 }, // keep 1hr in Redis, MySQL Delivery row is the durable record
      removeOnFail: false, // keep failed jobs visible until explicitly handled/replayed
      ...opts, // test-only override hook (e.g. lower attempts/delay) - never used in production calls
    }
  );
}

/**
 * The actual delivery worker logic, extracted as a standalone named export
 * (rather than an inline anonymous function passed to `new Worker(...)`)
 * specifically so it's unit-testable in isolation - tests can call this
 * directly with a fake job object and mocked axios/db, without needing a
 * real BullMQ Worker instance or Redis connection driving it.
 */
async function processDeliveryJob(job) {
  const { deliveryId, projectId, endpointUrl, secret, eventType, payload } = job.data;

  // Defense in depth against DNS rebinding: the endpoint URL was already
  // checked at registration time, but re-verify right before the actual
  // network call in case its DNS now resolves somewhere internal. If
  // it's blocked, dead-letter immediately rather than burning through 8
  // retries over ~21 minutes for something retrying can't fix.
  try {
    await assertPublicUrl(endpointUrl);
  } catch (err) {
    logger.error('Delivery blocked - endpoint does not resolve to a public address', {
      deliveryId,
      reason: err.message,
    });
    await prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: 'DEAD_LETTERED', deadLetteredAt: new Date(), responseBody: `Blocked: ${err.message}` },
    });
    emitDeliveryUpdate(projectId, { deliveryId, status: 'DEAD_LETTERED', reason: 'blocked_url' });
    return { success: false, blocked: true }; // not thrown - retrying a blocked URL is pointless
  }

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
  // truly "dead" (no attempts left) is decided in handleJobFailed below,
  // since only BullMQ knows the configured attempts ceiling.
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
}

const worker = new Worker(QUEUE_NAME, processDeliveryJob, {
  connection,
  concurrency: 5,
  // The HTTP call has a 10s timeout plus DB writes on either side of it -
  // lockDuration must comfortably exceed the worst case for a single
  // attempt, or BullMQ will think the worker died and reassign the job
  // to another worker while this one is still legitimately running.
  lockDuration: 60000,
  // If a job stalls (worker crashed mid-job, lock expired without being
  // renewed), allow exactly one re-attempt by another worker before
  // giving up on it as failed - a job that stalls twice is more likely a
  // poison-pill payload than bad luck.
  maxStalledCount: 1,
});

worker.on('error', (err) => {
  if (err.message.includes('ECONNRESET')) return;
  // BullMQ Worker is an EventEmitter - an unhandled 'error' event crashes
  // the whole Node process, so this listener is not optional.
  logger.error('Queue worker error', { error: err.message });
});

worker.on('completed', (job) => {
  logger.info('Delivery job succeeded', { jobId: job.id });
});

/**
 * Decides whether a failed job has exhausted its retries and, if so, marks
 * the delivery DEAD_LETTERED.
 *
 * This is wired to the Worker's OWN 'failed' event, not QueueEvents - that
 * was a real bug found during testing, not a style choice. QueueEvents'
 * 'failed' event only provides a jobId string, which then requires a
 * separate deliveryQueue.getJob(jobId) Redis round-trip to get the actual
 * job - and that round-trip can race against the job's own state
 * transitioning (e.g. moving into its next retry), occasionally returning
 * a job object with `.opts` not yet populated. Worker's own 'failed' event
 * hands you the fully-resolved job object directly, in the same process,
 * with no extra fetch and no race window - the correct choice for a
 * single-worker-process deployment like this one.
 *
 * Exported standalone (rather than inline) for direct unit testing -
 * `job` is whatever was passed to the listener, real or fake.
 */
async function handleJobFailed(job, err) {
  if (!job) return;
  logger.warn('Delivery job attempt failed', { jobId: job.id, reason: err?.message });

  try {
    const maxAttempts = job.opts.attempts || 1;
    const exhausted = job.attemptsMade >= maxAttempts;
    if (!exhausted) return; // BullMQ will still retry this one

    const { deliveryId, projectId } = job.data;
    await prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: 'DEAD_LETTERED', deadLetteredAt: new Date() },
    });
    emitDeliveryUpdate(projectId, { deliveryId, status: 'DEAD_LETTERED' });
    logger.warn('Delivery dead-lettered after exhausting retries', { deliveryId, attempts: job.attemptsMade });
  } catch (handlerErr) {
    logger.error('Failed to process dead-letter check', { jobId: job.id, error: handlerErr.message });
  }
}

worker.on('failed', handleJobFailed);

// QueueEvents is kept around only because it's a clean way to observe
// queue-level errors independent of any single worker, and because
// server.js closes it during graceful shutdown - it no longer drives any
// business logic (see handleJobFailed's docstring for why that moved to
// worker.on('failed') instead).
const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

queueEvents.on('error', (err) => {
  if (err.message.includes('ECONNRESET')) return;
  logger.error('Queue events error', { error: err.message });
});

module.exports = {
  deliveryQueue,
  enqueueDelivery,
  worker,
  queueEvents,
  processDeliveryJob,
  handleJobFailed,
};