// backend/test/signature.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { signPayload, verifySignature } = require('../src/utils/signature');

describe('signature', () => {
  const secret = 'test_secret_value';
  const body = JSON.stringify({ orderId: 'ord_1', amount: 100 });

  test('a signature verifies against the same secret and body', () => {
    const { header } = signPayload(secret, body);
    assert.equal(verifySignature(secret, body, header), true);
  });

  test('verification fails with the wrong secret', () => {
    const { header } = signPayload(secret, body);
    assert.equal(verifySignature('wrong_secret', body, header), false);
  });

  test('verification fails if the body is tampered with after signing', () => {
    const { header } = signPayload(secret, body);
    const tamperedBody = JSON.stringify({ orderId: 'ord_1', amount: 999999 });
    assert.equal(verifySignature(secret, tamperedBody, header), false);
  });

  test('verification fails with a missing signature header', () => {
    assert.equal(verifySignature(secret, body, undefined), false);
  });

  test('verification fails with a malformed signature header', () => {
    assert.equal(verifySignature(secret, body, 'not-a-valid-header'), false);
  });

  test('verification fails once the signature is older than the tolerance window', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 1000; // 1000s ago
    const { header } = signPayload(secret, body, oldTimestamp);
    assert.equal(verifySignature(secret, body, header, 300), false); // 300s tolerance
  });

  test('verification succeeds within the tolerance window', () => {
    const recentTimestamp = Math.floor(Date.now() / 1000) - 10; // 10s ago
    const { header } = signPayload(secret, body, recentTimestamp);
    assert.equal(verifySignature(secret, body, header, 300), true);
  });
});