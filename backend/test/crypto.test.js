// backend/test/crypto.test.js

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

before(() => {
  process.env.ENV_ENCRYPTION_KEY = '01234567890123456789012345678901'; // 32 chars
});

const { encrypt, decrypt } = require('../src/utils/crypto');

describe('crypto', () => {
  test('decrypt(encrypt(x)) returns the original value', () => {
    const original = 'whsec_some_secret_value';
    assert.equal(decrypt(encrypt(original)), original);
  });

  test('encrypting the same value twice produces different ciphertext (random IV)', () => {
    const original = 'whsec_some_secret_value';
    assert.notEqual(encrypt(original), encrypt(original));
  });

  test('tampering with the stored ciphertext is rejected, not silently decrypted', () => {
    const encrypted = encrypt('whsec_some_secret_value');
    const tampered = encrypted.slice(0, -2) + 'ff';
    assert.throws(() => decrypt(tampered));
  });

  test('throws if ENV_ENCRYPTION_KEY is not exactly 32 characters', () => {
    const original = process.env.ENV_ENCRYPTION_KEY;
    process.env.ENV_ENCRYPTION_KEY = 'too_short';
    assert.throws(() => encrypt('x'));
    process.env.ENV_ENCRYPTION_KEY = original;
  });
});