const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../config/logger');

// Tests read sent mail from here instead of a real inbox.
const outbox = [];

const transport = env.smtpUrl ? nodemailer.createTransport(env.smtpUrl) : null;

/**
 * Sends an email through SMTP when configured. Without SMTP (local development) the message is
 * logged instead, so links such as password resets can still be followed. Production requires SMTP.
 */
async function sendMail({ to, subject, text }) {
  if (env.isTest) {
    outbox.push({ to, subject, text });
    return;
  }
  if (transport) {
    await transport.sendMail({ from: env.mailFrom, to, subject, text });
    return;
  }
  if (env.isProd) throw new Error('SMTP_URL is not configured, so emails cannot be sent');
  logger.info(`[email to ${to}] ${subject}\n${text}`);
}

module.exports = { sendMail, outbox };
