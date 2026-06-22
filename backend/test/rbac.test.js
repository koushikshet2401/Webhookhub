// backend/test/rbac.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { requireRole } = require('../src/middleware/rbac.middleware');

function fakeRes() {
  return {
    _status: null,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
}

describe('rbac middleware', () => {
  test('allows a user whose role is in the allowed list', () => {
    const req = { user: { role: 'ADMIN' } };
    const res = fakeRes();
    let nextCalled = false;
    requireRole('ADMIN', 'DEVELOPER')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res._status, null);
  });

  test('blocks a user whose role is not in the allowed list', () => {
    const req = { user: { role: 'VIEWER' } };
    const res = fakeRes();
    let nextCalled = false;
    requireRole('ADMIN')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res._status, 403);
  });

  test('blocks an unauthenticated request (no req.user)', () => {
    const req = {};
    const res = fakeRes();
    let nextCalled = false;
    requireRole('ADMIN')(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res._status, 401);
  });
});