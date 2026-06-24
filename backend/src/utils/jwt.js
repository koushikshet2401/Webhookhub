// backend/src/utils/jwt.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getUserTokenGeneration } = require('./tokenRevocation');

async function signAccessToken(user) {
  const tgen = await getUserTokenGeneration(user.id);
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, jti: crypto.randomUUID(), tgen },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };