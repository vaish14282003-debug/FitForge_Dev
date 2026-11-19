const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../config/logger');

// Tests read sent mail from here instead of a real inbox.
const outbox = [];

const smtpTransport = env.smtpUrl ? nodemailer.createTransport(env.smtpUrl) : null;

// https://resend.com/docs/api-reference/emails/send-email
async function sendWithResend({ to, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.mailFrom, to: [to], subject, text, ...(html && { html }) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Resend refused the email (${res.status}): ${body.message || res.statusText}`);
  }
}

/** Which provider sends email: 'resend', 'smtp', or 'log' (development only). */
const mailProvider = env.resendApiKey ? 'resend' : smtpTransport ? 'smtp' : 'log';

/**
 * Sends an email through Resend or SMTP, whichever is configured (Resend wins if both are).
 * Without either (local development) the message is logged instead, so links such as password
 * resets can still be followed. Production refuses to fall back to the log.
 */
async function sendMail({ to, subject, text, html }) {
  if (env.isTest) {
    outbox.push({ to, subject, text, html });
    return;
  }
  if (mailProvider === 'resend') return sendWithResend({ to, subject, text, html });
  if (mailProvider === 'smtp') {
    await smtpTransport.sendMail({ from: env.mailFrom, to, subject, text, ...(html && { html }) });
    return;
  }
  if (env.isProd) throw new Error('No email provider configured (RESEND_API_KEY or SMTP_URL), so emails cannot be sent');
  logger.info(`[email to ${to}] ${subject}\n${text}`);
}

module.exports = { sendMail, outbox, mailProvider };
