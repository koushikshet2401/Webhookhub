// backend/test-helpers/mockDb.js

const path = require('path');

const dbPath = require.resolve('../src/config/db');
const redisPath = require.resolve('../src/config/redis');

/**
 * Replaces require('../config/db') with an in-memory mock for the duration
 * of fn(), then restores the real module. This lets controller tests run
 * without a real MySQL connection while still exercising the actual
 * controller code, not a re-implementation of it.
 */
async function withMockDb(mockDb, fn) {
  const previous = require.cache[dbPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: mockDb };
  try {
    return await fn();
  } finally {
    if (previous) {
      require.cache[dbPath] = previous;
    } else {
      delete require.cache[dbPath];
    }
  }
}

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function createMockDb() {
  let users = [];
  let projects = [];
  let nextUserId = 1;
  let nextProjectId = 1;

  return {
    _state: { users, projects },
    user: {
      async count() {
        return users.length;
      },
      async findUnique({ where }) {
        return users.find((u) => (where.email ? u.email === where.email : u.id === where.id)) || null;
      },
      async create({ data }) {
        const user = { id: nextUserId++, createdAt: new Date(), updatedAt: new Date(), ...data };
        users.push(user);
        return user;
      },
    },
    project: {
      async create({ data }) {
        const project = { id: nextProjectId++, isActive: true, createdAt: new Date(), updatedAt: new Date(), ...data };
        projects.push(project);
        return project;
      },
      async findMany() {
        return [...projects];
      },
      async findUnique({ where }) {
        return projects.find((p) => p.id === where.id) || null;
      },
    },
    auditLog: {
      async create() {
        return {};
      },
    },
  };
}

function fakeRes() {
  return {
    _status: 200,
    _body: undefined,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
    send(body) {
      this._body = body;
      return this;
    },
  };
}

/**
 * Generic version of withMockDb for any module - used to mock axios (so
 * worker tests don't make real network calls) and urlSafety (so worker
 * tests aren't subject to the real SSRF check, which has its own dedicated
 * test file and would otherwise reject every test fixture URL).
 */
async function withMockModule(modulePath, mockExports, fn) {
  const resolved = require.resolve(modulePath);
  const previous = require.cache[resolved];
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: mockExports };
  try {
    return await fn();
  } finally {
    if (previous) {
      require.cache[resolved] = previous;
    } else {
      delete require.cache[resolved];
    }
  }
}

function createMockDeliveryDb() {
  let deliveries = [];
  let attemptLogs = [];
  let nextDeliveryId = 1;
  let nextAttemptId = 1;

  return {
    _state: { deliveries, attemptLogs },
    delivery: {
      async create({ data }) {
        const delivery = { id: nextDeliveryId++, attemptCount: 0, createdAt: new Date(), ...data };
        deliveries.push(delivery);
        return delivery;
      },
      async update({ where, data }) {
        const delivery = deliveries.find((d) => d.id === where.id);
        Object.assign(delivery, data);
        return delivery;
      },
      async findUnique({ where }) {
        return deliveries.find((d) => d.id === where.id) || null;
      },
    },
    deliveryAttemptLog: {
      async create({ data }) {
        const log = { id: nextAttemptId++, attemptedAt: new Date(), ...data };
        attemptLogs.push(log);
        return log;
      },
    },
  };
}

module.exports = {
  withMockDb,
  withMockModule,
  freshRequire,
  createMockDb,
  createMockDeliveryDb,
  fakeRes,
  dbPath,
  redisPath,
};