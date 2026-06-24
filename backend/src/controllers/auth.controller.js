// backend/src/controllers/auth.controller.js

const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { logAction } = require('../utils/audit');
const {
  revokeToken,
  bumpUserTokenGeneration,
  createPasswordResetToken,
  consumePasswordResetToken,
} = require('../utils/tokenRevocation');
const { sendMail } = require('../utils/mailer');
const { createEmailVerificationToken, consumeEmailVerificationToken } = require('../utils/emailVerification');

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

  let user;
  try {
    user = await prisma.user.create({
      data: { name, email, passwordHash, role },
    });
  } catch (err) {
    // Two near-simultaneous registrations with the same email can both pass
    // the findUnique check above before either create() lands - that check
    // alone isn't a lock, it's just an early, friendly error for the common
    // case. MySQL's unique constraint is the real guarantee; this catches
    // the race and still returns a clean 409 instead of leaking a raw
    // Prisma error as a 500. Checking err.code directly (rather than
    // importing Prisma's error class) keeps this controller decoupled from
    // Prisma's internal type hierarchy - P2002 is a stable, documented
    // error code regardless of how the error object is constructed.
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    throw err;
  }

  await logAction({ userId: user.id, action: 'user.register', targetType: 'User', targetId: user.id });

  const verificationToken = await createEmailVerificationToken(user.id);
  const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/verify-email?token=${verificationToken}`;
  await sendMail({
    to: user.email,
    subject: 'Verify your WebhookHub email',
    text: `Welcome to WebhookHub!\n\nVerify your email: ${verifyLink}\n\nThis link expires in 24 hours.`,
  });

  const accessToken = await signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  return res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: false },
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

  const accessToken = await signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: !!user.emailVerifiedAt },
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

  const accessToken = await signAccessToken(user);
  return res.json({ accessToken });
}

async function logout(req, res) {
  // requireAuth already verified this token and attached its jti/exp -
  // revoke it so it stops working immediately, not just when it naturally
  // expires. This is real server-side logout, not just "client deletes it
  // and hopes."
  if (req.tokenContext?.jti && req.tokenContext?.exp) {
    await revokeToken(req.tokenContext.jti, req.tokenContext.exp);
  }
  return res.json({ message: 'Logged out' });
}

async function forgotPassword(req, res) {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return the same response whether or not the account exists -
  // returning a different response for "no such email" is exactly how
  // email enumeration attacks work.
  if (user) {
    const token = await createPasswordResetToken(user.id);
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password?token=${token}`;

    await sendMail({
      to: user.email,
      subject: 'Reset your WebhookHub password',
      text: `Someone requested a password reset for this account.\n\nReset your password: ${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
    });

    await logAction({ userId: user.id, action: 'user.password_reset_requested', targetType: 'User', targetId: user.id });
  }

  return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body;

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // A password reset should kill every existing session, not just future
  // logins - the whole point is "whoever had access before shouldn't anymore."
  await bumpUserTokenGeneration(userId);

  await logAction({ userId, action: 'user.password_reset_completed', targetType: 'User', targetId: userId });

  return res.json({ message: 'Password has been reset. Please log in again.' });
}

async function verifyEmail(req, res) {
  const { token } = req.body;

  const userId = await consumeEmailVerificationToken(token);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid or expired verification token' });
  }

  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await logAction({ userId, action: 'user.email_verified', targetType: 'User', targetId: userId });

  return res.json({ message: 'Email verified' });
}

async function resendVerification(req, res) {
  // Authenticated, not by-email - sidesteps email enumeration entirely,
  // since you can only ever request a new verification link for the
  // account you're already logged into.
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.emailVerifiedAt) {
    return res.json({ message: 'Email is already verified' });
  }

  const token = await createEmailVerificationToken(user.id);
  const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/verify-email?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Verify your WebhookHub email',
    text: `Verify your email: ${verifyLink}\n\nThis link expires in 24 hours.`,
  });

  return res.json({ message: 'Verification email sent' });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
};