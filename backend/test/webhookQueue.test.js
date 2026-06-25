// backend/test/webhookQueue.test.js

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { withMockDb, createMockDeliveryDb } = require('../test-helpers/mockDb');

process.env.ENV_ENCRYPTION_KEY = '01234567890123456789012345678901';
process.env.JWT_SECRET = 'test_jwt_secret';

// Mutable mock wrappers: webhookQueue.js is only ever required ONCE (below),
// so its captured `axios` and `assertPublicUrl` references are fixed at
// that load time. Rather than re-requiring the whole module per test (which
// creates a fresh, real BullMQ Queue/Worker/QueueEvents trio every time -
// expensive, and a real cleanup hazard if any of them get missed), each
// test instead reassigns these mutable closures to control what the
// ALREADY-LOADED module sees on its next call.
let mockPostImpl = async () => ({ status: 200, data: {} });
const mockAxios = { post: (...args) => mockPostImpl(...args) };

let mockAssertPublicUrlImpl = async () => undefined;
const mockUrlSafety = { assertPublicUrl: (...args) => mockAssertPublicUrlImpl(...args) };

const mockDb = createMockDeliveryDb();

let queueModule;

before(async () => {
  const axiosPath = require.resolve('axios');
  require.cache[axiosPath] = { id: axiosPath, filename: axiosPath, loaded: true, exports: mockAxios };

  const urlSafetyPath = require.resolve('../src/utils/urlSafety');
  require.cache[urlSafetyPath] = { id: urlSafetyPath, filename: urlSafetyPath, loaded: true, exports: mockUrlSafety };

  const dbPath = require.resolve('../src/config/db');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb };

  queueModule = require('../src/queues/webhookQueue');
});

after(async () => {
  await queueModule.worker.close();
  await queueModule.queueEvents.close();
  await queueModule.deliveryQueue.close();
  const redis = require('../src/config/redis');
  redis.disconnect();

  // BullMQ's Worker and QueueEvents each internally duplicate the shared
  // connection for their blocking operations (confirmed by reading their
  // source - this isn't a guess). Their own .close() calls don't reliably
  // release every duplicated socket, which leaves node:test's runner
  // waiting forever for an event loop that will never empty on its own -
  // confirmed by direct testing, not just a slow teardown (the handle
  // never clears no matter how long you wait).
  //
  // This is the exact same reasoning server.js's graceful shutdown already
  // uses process.exit() for: by this point every test has already run and
  // been reported by node:test, so a forced exit here loses no test
  // signal - it just skips waiting on a handle that was never going to
  // close on its own.
  process.exit(0);
});

function fakeJob({ data, attemptsMade = 0, opts = { attempts: 8 } }) {
  return { id: 'fake-job-1', data, attemptsMade, opts };
}

describe('webhookQueue - processDeliveryJob', () => {
  test('a successful (2xx) response marks the delivery SUCCESS', async () => {
    const delivery = await mockDb.delivery.create({ data: { eventId: 1, endpointId: 1, status: 'PENDING' } });
    mockPostImpl = async () => ({ status: 200, data: { ok: true } });
    mockAssertPublicUrlImpl = async () => undefined;

    const job = fakeJob({
      data: {
        deliveryId: delivery.id,
        projectId: 1,
        endpointUrl: 'https://example.com/webhook',
        secret: 'whsec_test',
        eventType: 'order.created',
        payload: { orderId: 1 },
      },
    });

    const result = await queueModule.processDeliveryJob(job);

    assert.equal(result.success, true);
    const updated = await mockDb.delivery.findUnique({ where: { id: delivery.id } });
    assert.equal(updated.status, 'SUCCESS');
    assert.equal(updated.attemptCount, 1);
  });

  test('a non-2xx response marks the delivery DELIVERING and throws (to trigger a BullMQ retry)', async () => {
    const delivery = await mockDb.delivery.create({ data: { eventId: 1, endpointId: 1, status: 'PENDING' } });
    mockPostImpl = async () => ({ status: 500, data: { error: 'server error' } });
    mockAssertPublicUrlImpl = async () => undefined;

    const job = fakeJob({
      data: {
        deliveryId: delivery.id,
        projectId: 1,
        endpointUrl: 'https://example.com/webhook',
        secret: 'whsec_test',
        eventType: 'order.created',
        payload: { orderId: 1 },
      },
    });

    await assert.rejects(() => queueModule.processDeliveryJob(job), /500/);

    const updated = await mockDb.delivery.findUnique({ where: { id: delivery.id } });
    assert.equal(updated.status, 'DELIVERING');
    assert.equal(updated.responseStatusCode, 500);
  });

  test('a network error (no response at all) still records the attempt and throws', async () => {
    const delivery = await mockDb.delivery.create({ data: { eventId: 1, endpointId: 1, status: 'PENDING' } });
    mockPostImpl = async () => {
      throw new Error('ECONNREFUSED');
    };
    mockAssertPublicUrlImpl = async () => undefined;

    const job = fakeJob({
      data: {
        deliveryId: delivery.id,
        projectId: 1,
        endpointUrl: 'https://example.com/webhook',
        secret: 'whsec_test',
        eventType: 'order.created',
        payload: { orderId: 1 },
      },
    });

    await assert.rejects(() => queueModule.processDeliveryJob(job), /ECONNREFUSED/);

    const updated = await mockDb.delivery.findUnique({ where: { id: delivery.id } });
    assert.equal(updated.status, 'DELIVERING');
    assert.equal(updated.responseStatusCode, null);
  });

  test('a blocked URL (SSRF/DNS-rebinding check fails) dead-letters immediately WITHOUT throwing', async () => {
    const delivery = await mockDb.delivery.create({ data: { eventId: 1, endpointId: 1, status: 'PENDING' } });
    mockAssertPublicUrlImpl = async () => {
      throw new Error('resolves to a private address');
    };

    const job = fakeJob({
      data: {
        deliveryId: delivery.id,
        projectId: 1,
        endpointUrl: 'https://rebound-example.com/webhook',
        secret: 'whsec_test',
        eventType: 'order.created',
        payload: { orderId: 1 },
      },
    });

    // Deliberately NOT assert.rejects - a blocked URL must resolve
    // normally, not throw, since retrying it can never help.
    const result = await queueModule.processDeliveryJob(job);
    assert.equal(result.blocked, true);

    const updated = await mockDb.delivery.findUnique({ where: { id: delivery.id } });
    assert.equal(updated.status, 'DEAD_LETTERED');
    assert.ok(updated.deadLetteredAt);
  });
});

describe('webhookQueue - handleJobFailed', () => {
  test('does NOT dead-letter when attempts remain', async () => {
    const delivery = await mockDb.delivery.create({ data: { eventId: 1, endpointId: 1, status: 'DELIVERING' } });

    const job = fakeJob({
      data: { deliveryId: delivery.id, projectId: 1 },
      attemptsMade: 1,
      opts: { attempts: 8 },
    });

    await queueModule.handleJobFailed(job, new Error('temporary failure'));

    const updated = await mockDb.delivery.findUnique({ where: { id: delivery.id } });
    assert.equal(updated.status, 'DELIVERING'); // unchanged - handleJobFailed should not have touched it
  });

  test('DOES dead-letter once attemptsMade reaches the configured ceiling', async () => {
    const delivery = await mockDb.delivery.create({ data: { eventId: 1, endpointId: 1, status: 'DELIVERING' } });

    const job = fakeJob({
      data: { deliveryId: delivery.id, projectId: 1 },
      attemptsMade: 8,
      opts: { attempts: 8 },
    });

    await queueModule.handleJobFailed(job, new Error('final failure'));

    const updated = await mockDb.delivery.findUnique({ where: { id: delivery.id } });
    assert.equal(updated.status, 'DEAD_LETTERED');
    assert.ok(updated.deadLetteredAt);
  });

  test('a missing job (null) is a no-op, not a crash', async () => {
    await assert.doesNotReject(() => queueModule.handleJobFailed(null, new Error('x')));
  });
});