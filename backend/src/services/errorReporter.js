const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../config/logger');

/**
 * Sends unexpected server errors to Sentry when SENTRY_DSN is set; otherwise does nothing.
 *
 * Uses Sentry's documented envelope endpoint directly, so the API doesn't carry the full SDK
 * (which bundles build tooling). Best effort: it never throws and gives up after a few seconds.
 * Only the error, the route and the user id are sent; never request bodies, cookies or query strings.
 */

function parseDsn(dsn) {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+|\/+$/g, '');
    if (!url.username || !projectId) return null;
    return {
      dsn,
      key: url.username,
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

// "    at fn (/app/src/x.js:10:5)" or "    at /app/src/x.js:10:5". Sentry wants oldest call first.
function stackFrames(stack = '') {
  return stack
    .split('\n')
    .slice(1)
    .map((line) => line.trim().match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/))
    .filter(Boolean)
    .map(([, fn, file, line, col]) => ({
      function: fn || '<anonymous>',
      filename: file,
      lineno: Number(line),
      colno: Number(col),
      in_app: !file.includes('node_modules') && !file.startsWith('node:'),
    }))
    .reverse();
}

function buildEvent(err, context = {}) {
  const error = err instanceof Error ? err : new Error(String(err));
  return {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    environment: env.nodeEnv,
    exception: {
      values: [{ type: error.name, value: error.message, stacktrace: { frames: stackFrames(error.stack) } }],
    },
    ...(context.request && {
      request: { method: context.request.method, url: context.request.path },
      transaction: `${context.request.method} ${context.request.path}`,
    }),
    ...(context.userId && { user: { id: String(context.userId) } }),
    ...(context.tags && { tags: context.tags }),
  };
}

function buildEnvelope(event, target) {
  return [
    JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString(), dsn: target.dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');
}

const target = parseDsn(env.sentryDsn);

async function reportError(err, context) {
  if (!target || env.isTest) return;
  try {
    const event = buildEvent(err, context);
    const res = await fetch(target.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=fitforge-api/1.0`,
      },
      body: buildEnvelope(event, target),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) logger.warn(`Error report rejected by Sentry (${res.status})`);
  } catch (sendErr) {
    logger.warn(`Could not send error report: ${sendErr.message}`);
  }
}

module.exports = { reportError, parseDsn, buildEvent, buildEnvelope, stackFrames };
