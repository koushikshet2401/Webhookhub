// backend/test/urlSafety.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { assertPublicUrl } = require('../src/utils/urlSafety');

async function isBlocked(url) {
  try {
    await assertPublicUrl(url);
    return false;
  } catch {
    return true;
  }
}

describe('urlSafety - SSRF protection', () => {
  test('blocks localhost', async () => {
    assert.equal(await isBlocked('http://localhost/admin'), true);
  });

  test('blocks 127.0.0.1 (loopback literal)', async () => {
    assert.equal(await isBlocked('http://127.0.0.1:8080/'), true);
  });

  test('blocks cloud metadata address 169.254.169.254', async () => {
    assert.equal(await isBlocked('http://169.254.169.254/latest/meta-data/'), true);
  });

  test('blocks private 10.x range', async () => {
    assert.equal(await isBlocked('http://10.0.5.5/internal'), true);
  });

  test('blocks private 192.168.x range', async () => {
    assert.equal(await isBlocked('http://192.168.1.1/'), true);
  });

  test('blocks private 172.16-31.x range', async () => {
    assert.equal(await isBlocked('http://172.16.0.5/'), true);
    assert.equal(await isBlocked('http://172.31.255.255/'), true);
  });

  test('does not block addresses just outside the 172.16-31.x range', async () => {
    // 172.15.x and 172.32.x are public ranges - a boundary check worth
    // having, since an off-by-one in the CIDR math would either leak a
    // private range or wrongly block public addresses.
    assert.equal(await isBlocked('http://172.15.255.255/'), false);
    assert.equal(await isBlocked('http://172.32.0.1/'), false);
  });

  test('blocks IPv6 loopback', async () => {
    assert.equal(await isBlocked('http://[::1]/'), true);
  });

  test('blocks non-http(s) protocols', async () => {
    assert.equal(await isBlocked('ftp://example.com/'), true);
  });

  test('rejects a malformed URL outright', async () => {
    assert.equal(await isBlocked('not-a-url-at-all'), true);
  });

  test('allows a public IP literal', async () => {
    assert.equal(await isBlocked('http://8.8.8.8/'), false);
  });

  test('allows a real public domain', async () => {
    assert.equal(await isBlocked('https://example.com/webhook'), false);
  });
});