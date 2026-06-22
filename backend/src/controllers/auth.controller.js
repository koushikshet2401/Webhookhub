// backend/src/controllers/auth.controller.js

const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { logAction } = require('../utils/audit');

async function register(req, res) {
  const { name, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  // First user to register becomes ADMIN so there's always someone who can
  // manage the system. Every user after that defaults to DEVELOPER no matter
  // what role the client sends - privilege escalation must happen through an
  // authenticated admin action, never at signup.
  const userCount = await prisma.user.count();
  const role = userCount === 0 ? 'ADMIN' : 'DEVELOPER';

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

  await logAction({ userId: user.id, action: 'user.register', targetType: 'User', targetId: user.id });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  return res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  await logAction({ userId: user.id, action: 'user.login', targetType: 'User', targetId: user.id });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }

  const accessToken = signAccessToken(user);
  return res.json({ accessToken });
}

async function logout(req, res) {
  // Stateless JWTs can't be revoked individually without a blacklist.
  // For now this is a client-side token discard. If you need true
  // server-side logout, add a RevokedToken table keyed by jti and check
  // it in requireAuth - good Section 5 hardening task.
  return res.json({ message: 'Logged out' });
}

module.exports = { register, login, refresh, logout };