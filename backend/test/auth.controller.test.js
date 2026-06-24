// backend/test/auth.controller.test.js

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { withMockDb, freshRequire, createMockDb, fakeRes } = require('../test-helpers/mockDb');

before(() => {
  process.env.JWT_SECRET = 'test_jwt_secret';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
  process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
});

after(() => {
  // auth.controller -> tokenRevocation -> config/redis opens a real Redis
  // connection at require time (for the logout/revocation path), which
  // would otherwise keep this test file's process alive indefinitely.
  const redis = require('../src/config/redis');
  redis.disconnect();
});

describe('auth.controller', () => {
  test('register: first user becomes ADMIN', async () => {
    const mockDb = createMockDb();
    await withMockDb(mockDb, async () => {
      const { register } = freshRequire('../src/controllers/auth.controller');
      const req = { body: { name: 'Admin', email: 'admin@example.com', password: 'password123' } };
      const res = fakeRes();

      await register(req, res);

      assert.equal(res._status, 201);
      assert.equal(res._body.user.role, 'ADMIN');
      assert.ok(res._body.accessToken);
      assert.ok(res._body.refreshToken);
    });
  });

  test('register: second user defaults to DEVELOPER, not ADMIN', async () => {
    const mockDb = createMockDb();
    await withMockDb(mockDb, async () => {
      const { register } = freshRequire('../src/controllers/auth.controller');

      await register({ body: { name: 'First', email: 'first@example.com', password: 'password123' } }, fakeRes());

      const res2 = fakeRes();
      await register({ body: { name: 'Second', email: 'second@example.com', password: 'password123' } }, res2);

      assert.equal(res2._body.user.role, 'DEVELOPER');
    });
  });

  test('register: rejects a duplicate email with 409', async () => {
    const mockDb = createMockDb();
    await withMockDb(mockDb, async () => {
      const { register } = freshRequire('../src/controllers/auth.controller');
      const body = { name: 'A', email: 'dupe@example.com', password: 'password123' };

      await register({ body }, fakeRes());
      const res2 = fakeRes();
      await register({ body }, res2);

      assert.equal(res2._status, 409);
    });
  });

  test('login: succeeds with correct credentials and fails with wrong password', async () => {
    const mockDb = createMockDb();
    await withMockDb(mockDb, async () => {
      const { register, login } = freshRequire('../src/controllers/auth.controller');
      await register({ body: { name: 'A', email: 'login@example.com', password: 'password123' } }, fakeRes());

      const goodRes = fakeRes();
      await login({ body: { email: 'login@example.com', password: 'password123' } }, goodRes);
      assert.equal(goodRes._status, 200);
      assert.ok(goodRes._body.accessToken);

      const badRes = fakeRes();
      await login({ body: { email: 'login@example.com', password: 'wrong-password' } }, badRes);
      assert.equal(badRes._status, 401);
    });
  });

  test('login: fails for an email that was never registered', async () => {
    const mockDb = createMockDb();
    await withMockDb(mockDb, async () => {
      const { login } = freshRequire('../src/controllers/auth.controller');
      const res = fakeRes();
      await login({ body: { email: 'nobody@example.com', password: 'whatever123' } }, res);
      assert.equal(res._status, 401);
    });
  });
});