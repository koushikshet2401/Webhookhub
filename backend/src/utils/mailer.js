// backend/src/utils/mailer.js

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null; // dev mode - no SMTP configured
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/**
 * Sends an email, or in dev mode (no SMTP_HOST configured), logs it to the
 * console instead of failing. This mirrors the "Demo Mode" pattern used
 * elsewhere - you can fully exercise the password-reset flow locally
 * without ever configuring a real mail provider.
 */
async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.log('[mailer] DEV MODE - no SMTP_HOST configured, logging email instead of sending:');
    console.log(`[mailer] To: ${to}`);
    console.log(`[mailer] Subject: ${subject}`);
    console.log(`[mailer] Body:\n${text}`);
    return { devMode: true };
  }

  return t.sendMail({
    from: process.env.EMAIL_FROM || 'WebhookHub <noreply@webhookhub.local>',
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendMail };