// Checks run when NODE_ENV=production so a live deployment can't quietly keep development
// shortcuts. A site on localhost (e.g. `docker compose --profile full`) gets the relaxed rules.

const PLACEHOLDER_SECRETS = ['change-me', 'changeme', 'test-secret', 'local-compose-secret', 'secret-secret', 'your-secret'];

function isLocalUrl(url) {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Settings that make a production deployment unsafe. The API refuses to start with any of them. */
function productionProblems(config) {
  const problems = [];
  const local = isLocalUrl(config.clientOrigin) && isLocalUrl(config.appUrl);
  if (local) return problems;

  const secret = config.jwtAccessSecret;
  if (PLACEHOLDER_SECRETS.some((p) => secret.toLowerCase().includes(p)) || new Set(secret).size < 12) {
    problems.push(
      "JWT_ACCESS_SECRET looks like a placeholder. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }
  for (const [name, url] of [['CLIENT_ORIGIN', config.clientOrigin], ['APP_URL', config.appUrl]]) {
    if (!url.startsWith('https://')) problems.push(`${name} must be the website's https:// address (got ${url})`);
  }
  return problems;
}

/** Settings that work but leave a feature broken. Logged once at startup. */
function productionWarnings(config) {
  const warnings = [];
  if (isLocalUrl(config.clientOrigin)) return warnings;
  if (!config.resendApiKey && !config.smtpUrl) {
    warnings.push('No email provider (RESEND_API_KEY or SMTP_URL): password reset emails cannot be sent.');
  }
  if (config.storage.driver === 'local') {
    warnings.push('STORAGE_DRIVER=local: uploads are lost when the server is redeployed. Use s3.');
  }
  if (!config.sentryDsn) warnings.push('SENTRY_DSN is not set: server errors are only in the log.');
  return warnings;
}

module.exports = { productionProblems, productionWarnings, isLocalUrl };
