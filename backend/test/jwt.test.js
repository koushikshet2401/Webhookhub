// backend/test/jwt.test.js

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

before(() => {
  process.env.JWT_SECRET = 'test_jwt_secret';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
  process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '30d';
});

after(() => {
  // jwt.js -> tokenRevocation.js -> config/redis opens a real Redis
  // connection (to read the token generation counter), which would
  // otherwise keep this test file's process alive indefinitely.
  const redis = require('../src/config/redis');
  redis.disconnect();
});

const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../src/utils/jwt');

describe('jwt', () => {
  const user = { id: 1, email: 'a@b.com', role: 'ADMIN' };

  test('an access token verifies and carries the expected claims', async () => {
    const token = await signAccessToken(user);
    const decoded = verifyAccessToken(token);
    assert.equal(decoded.sub, user.id);
    assert.equal(decoded.email, user.email);
    assert.equal(decoded.role, user.role);
    assert.equal(decoded.tgen, 0); // no password reset has happened for this user yet
  });

  test('a refresh token verifies and carries only the subject claim', () => {
    const token = signRefreshToken(user);
    const decoded = verifyRefreshToken(token);
    assert.equal(decoded.sub, user.id);
    assert.equal(decoded.email, undefined); // refresh tokens deliberately carry less
  });

  test('an access token cannot be verified as a refresh token (different secrets)', async () => {
    const token = await signAccessToken(user);
    assert.throws(() => verifyRefreshToken(token));
  });

  test('a tampered token fails verification', async () => {
    const token = await signAccessToken(user);
    const tampered = token.slice(0, -2) + 'zz';
    assert.throws(() => verifyAccessToken(tampered));
  });

  test('an expired token fails verification', () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '-10s' });
    assert.throws(() => verifyAccessToken(expired));
  });
});