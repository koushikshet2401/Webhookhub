// backend/test/apiKey.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { generateApiKey, hashApiKey, extractPrefix } = require('../src/utils/apiKey');

describe('apiKey', () => {
  test('a generated key has the expected format and matching prefix', () => {
    const { fullKey, prefix } = generateApiKey();
    assert.match(fullKey, /^whsk_[0-9a-f]{48}$/);
    assert.equal(fullKey.split('_')[1].slice(0, 8), prefix);
  });

  test('hashing the same key twice produces the same hash (deterministic)', () => {
    const { fullKey } = generateApiKey();
    assert.equal(hashApiKey(fullKey), hashApiKey(fullKey));
  });

  test('two generated keys never collide in hash or prefix (extremely high probability)', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    assert.notEqual(a.fullKey, b.fullKey);
    assert.notEqual(a.keyHash, b.keyHash);
    assert.notEqual(a.prefix, b.prefix);
  });

  test('a single tampered character changes the hash completely', () => {
    const { fullKey, keyHash } = generateApiKey();
    const tampered = fullKey.slice(0, -1) + (fullKey.slice(-1) === 'a' ? 'b' : 'a');
    assert.notEqual(hashApiKey(tampered), keyHash);
  });

  test('extractPrefix correctly parses a well-formed key', () => {
    const { fullKey, prefix } = generateApiKey();
    assert.equal(extractPrefix(fullKey), prefix);
  });

  test('extractPrefix rejects malformed keys', () => {
    assert.equal(extractPrefix('not-a-key'), null);
    assert.equal(extractPrefix('wrongprefix_abc123'), null);
    assert.equal(extractPrefix(''), null);
  });
});