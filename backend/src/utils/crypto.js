// backend/src/utils/crypto.js

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const key = process.env.ENV_ENCRYPTION_KEY;
  if (!key || key.length !== 32) {
    throw new Error('ENV_ENCRYPTION_KEY must be set to exactly 32 characters');
  }
  return Buffer.from(key, 'utf8');
}

// Stored format: "<iv>:<authTag>:<ciphertext>", all hex. GCM gives us both
// confidentiality and integrity (tampering with the stored blob fails decrypt
// instead of silently returning garbage).
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(stored) {
  const [ivHex, tagHex, dataHex] = stored.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };