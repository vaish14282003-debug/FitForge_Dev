const env = require('../config/env');
const logger = require('../config/logger');
const StravaConnection = require('../models/StravaConnection');
const { seal, open } = require('../utils/secretBox');

// Strava API, per https://developers.strava.com/docs/authentication/ and /docs/reference/.
const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const REVOKE_URL = 'https://www.strava.com/oauth/revoke';
const ACTIVITIES_URL = 'https://www.strava.com/api/v3/activities';
// Creating activities needs activity:write; read gives the athlete's name for the profile card.
const SCOPE = 'read,activity:write';
const TIMEOUT_MS = 10_000;

class StravaError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Strava is offered only when the app is registered with Strava and tokens can be encrypted. */
const isAvailable = () => Boolean(env.strava.clientId && env.strava.clientSecret && env.tokenEncryptionKey);

const redirectUri = () => `${env.appUrl.replace(/\/$/, '')}/api/integrations/strava/callback`;

function authorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: env.strava.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

const hasWriteScope = (scope) => String(scope || '').split(/[ ,]+/).includes('activity:write');

async function post(url, form, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.message || res.statusText;
    throw new StravaError(res.status, res.status === 429 ? 'Strava is busy right now. Try again in 15 minutes.' : `Strava: ${detail}`);
  }
  return body;
}

/** After the athlete approves: swap the one-time code for tokens and remember the connection. */
async function connect(userId, code) {
  const token = await post(TOKEN_URL, {
    client_id: env.strava.clientId,
    client_secret: env.strava.clientSecret,
    code,
    grant_type: 'authorization_code',
  });
  const athlete = token.athlete || {};
  return StravaConnection.findOneAndUpdate(
    { user: userId },
    {
      user: userId,
      athleteId: String(athlete.id ?? ''),
      athleteName: [athlete.firstname, athlete.lastname].filter(Boolean).join(' '),
      scope: token.scope || '',
      accessToken: seal(token.access_token),
      refreshToken: seal(token.refresh_token),
      expiresAt: new Date(token.expires_at * 1000),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/** A usable access token, refreshing it first when it's about to expire (they last six hours). */
async function accessToken(connection) {
  if (connection.expiresAt.getTime() - Date.now() > 60_000) return open(connection.accessToken);
  const token = await post(TOKEN_URL, {
    client_id: env.strava.clientId,
    client_secret: env.strava.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: open(connection.refreshToken),
  });
  // Strava may hand out a new refresh token and invalidate the old one at once: keep the newest.
  connection.accessToken = seal(token.access_token);
  connection.refreshToken = seal(token.refresh_token);
  connection.expiresAt = new Date(token.expires_at * 1000);
  await connection.save();
  return token.access_token;
}

const formatWeight = (kg) => `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;

/** The text shown on Strava: each exercise's completed sets, then totals. */
function describe(session) {
  const lines = session.entries
    .map((entry) => {
      const done = entry.sets.filter((s) => s.done);
      if (!done.length) return null;
      const sets = done.map((s) => (s.weight ? `${s.reps}×${formatWeight(s.weight)}` : `${s.reps}`)).join(', ');
      return `${entry.exerciseName}: ${sets}`;
    })
    .filter(Boolean);
  const totals = [`${session.completedSets} sets`];
  if (session.totalVolume > 0) totals.push(`${Math.round(session.totalVolume).toLocaleString('en-IN')} kg volume`);
  if (session.prs?.length) totals.push(`${session.prs.length} personal record${session.prs.length > 1 ? 's' : ''}`);
  return [...lines, '', totals.join(' · '), 'Logged with FitForge'].join('\n');
}

function activityFor(session) {
  return {
    name: `${session.dayName} · ${session.planName}`,
    sport_type: 'WeightTraining',
    type: 'WeightTraining',
    start_date_local: new Date(session.startedAt).toISOString(),
    elapsed_time: String(Math.max(60, session.durationSeconds)),
    description: describe(session),
    trainer: '1',
  };
}

/**
 * Creates the Strava activity for a saved workout and records the outcome on the session. Never
 * throws: a Strava problem must not affect saving the workout. A revoked connection is removed.
 */
async function uploadSession(session, connection) {
  try {
    const token = await accessToken(connection);
    const activity = await post(ACTIVITIES_URL, activityFor(session), { Authorization: `Bearer ${token}` });
    session.strava = { activityId: String(activity.id), status: 'uploaded', error: null };
  } catch (err) {
    if (err.status === 401) {
      // The athlete revoked FitForge on Strava's side; they'll see "Connect" again.
      await StravaConnection.deleteOne({ _id: connection._id });
      session.strava = { activityId: null, status: 'failed', error: 'Strava access was removed. Connect Strava again.' };
    } else {
      logger.warn(`Strava upload failed for session ${session.id}: ${err.message}`);
      session.strava = {
        activityId: null,
        status: 'failed',
        error: err instanceof StravaError ? err.message : 'Could not reach Strava. Try again later.',
      };
    }
  }
  await session.save();
  return session;
}

/** Upload right after a workout is saved, if this member connected Strava with auto-upload on. */
async function autoUpload(session) {
  if (!isAvailable()) return session;
  const connection = await StravaConnection.findOne({ user: session.member });
  if (!connection?.autoUpload) return session;
  return uploadSession(session, connection);
}

/** Disconnect: revoke on Strava's side (best effort), then forget the tokens. */
async function disconnect(userId) {
  const connection = await StravaConnection.findOne({ user: userId });
  if (!connection) return;
  try {
    const basic = Buffer.from(`${env.strava.clientId}:${env.strava.clientSecret}`).toString('base64');
    await post(REVOKE_URL, { token: open(connection.refreshToken), token_type_hint: 'refresh_token' }, { Authorization: `Basic ${basic}` });
  } catch (err) {
    logger.warn(`Strava revoke failed for user ${userId}: ${err.message}`);
  }
  await StravaConnection.deleteOne({ _id: connection._id });
}

module.exports = {
  isAvailable,
  authorizeUrl,
  redirectUri,
  hasWriteScope,
  connect,
  uploadSession,
  autoUpload,
  disconnect,
  activityFor,
  describe,
  StravaError,
};
