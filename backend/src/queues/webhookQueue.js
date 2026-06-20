const { Queue, Worker, QueueEvents } = require('bullmq');
const axios = require('axios');
const connection = require('../config/redis');
const { signPayload } = require('../utils/signature');

const QUEUE_NAME = process.env.DELIVERY_QUEUE_NAME || 'webhook-deliveries';

// ---- Queue: where new delivery jobs get added ----
const deliveryQueue = new Queue(QUEUE_NAME, { connection });

/**
 * Enqueue a delivery attempt for one (event, endpoint) pair.
 * Retry/backoff is handled by BullMQ - exponential backoff starting at 5s,
 * capped at 8 attempts before the job is considered dead-lettered.
 */
async function enqueueDelivery({ deliveryId, endpointUrl, secret, eventType, payload }) {
  return deliveryQueue.add(
    'deliver',
    { deliveryId, endpointUrl, secret, eventType, payload },
    {
      attempts: 8,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 3600 }, // keep 1hr in Redis, MySQL Job table is the durable record
      removeOnFail: false, // keep failed jobs visible until explicitly handled/replayed
    }
  );
}

// ---- Worker: actually performs the HTTP delivery ----
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { endpointUrl, secret, eventType, payload } = job.data;
    const rawBody = JSON.stringify(payload);
    const { header } = signPayload(secret, rawBody);

    const startedAt = Date.now();
    const response = await axios.post(endpointUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-WebhookHub-Signature': header,
        'X-WebhookHub-Event': eventType,
      },
      timeout: 10000,
      validateStatus: () => true, // we want to inspect non-2xx ourselves
    });
    const latencyMs = Date.now() - startedAt;

    if (response.status >= 200 && response.status < 300) {
      // TODO (Phase 1+): update Delivery row -> SUCCESS, store latencyMs/status code
      return { success: true, status: response.status, latencyMs };
    }

    // Non-2xx -> throw so BullMQ applies the configured retry/backoff
    throw new Error(`Endpoint responded with status ${response.status}`);
  },
  { connection, concurrency: 5 }
);

const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`[queue] delivery ${jobId} succeeded`, returnvalue);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.log(`[queue] delivery ${jobId} attempt failed: ${failedReason}`);
  // TODO (Phase 1+): if job.attemptsMade === job.opts.attempts,
  // mark the Delivery row DEAD_LETTERED and move it into the dead-letter view
});

module.exports = { deliveryQueue, enqueueDelivery, worker, queueEvents };
