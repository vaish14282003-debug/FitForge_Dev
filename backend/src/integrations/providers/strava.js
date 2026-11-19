const env = require('../../config/env');
const { postForm } = require('../http');
const { workoutSummary } = require('../format');

// Strava, per https://developers.strava.com/docs/authentication/ and /docs/reference/.
// Settings: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET (from strava.com/settings/api).
const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const REVOKE_URL = 'https://www.strava.com/oauth/revoke';
const ACTIVITIES_URL = 'https://www.strava.com/api/v3/activities';
// Creating activities needs activity:write; read gives the athlete's name for the profile card.
const SCOPE = 'read,activity:write';
const opts = (headers) => ({ headers, providerName: 'Strava' });
const client = () => ({ client_id: env.strava.clientId, client_secret: env.strava.clientSecret });

/** @type {import('../registry').Provider} */
module.exports = {
  id: 'strava',
  name: 'Strava',
  isConfigured: () => Boolean(env.strava.clientId && env.strava.clientSecret),

  authorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: env.strava.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: SCOPE,
      state,
    });
    return `${AUTHORIZE_URL}?${params}`;
  },

  hasRequiredScope: (scope) => String(scope || '').split(/[ ,]+/).includes('activity:write'),

  async exchangeCode({ code }) {
    const token = await postForm(TOKEN_URL, { ...client(), code, grant_type: 'authorization_code' }, opts());
    const athlete = token.athlete || {};
    return {
      externalId: String(athlete.id ?? ''),
      displayName: [athlete.firstname, athlete.lastname].filter(Boolean).join(' '),
      scope: token.scope || '',
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(token.expires_at * 1000),
    };
  },

  // Strava may return a new refresh token and invalidate the old one at once; the service keeps it.
  async refresh({ refreshToken }) {
    const token = await postForm(TOKEN_URL, { ...client(), grant_type: 'refresh_token', refresh_token: refreshToken }, opts());
    return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: new Date(token.expires_at * 1000) };
  },

  async uploadWorkout({ accessToken, session }) {
    const activity = await postForm(
      ACTIVITIES_URL,
      {
        name: `${session.dayName} · ${session.planName}`,
        sport_type: 'WeightTraining',
        type: 'WeightTraining',
        start_date_local: new Date(session.startedAt).toISOString(),
        elapsed_time: String(Math.max(60, session.durationSeconds)),
        description: workoutSummary(session),
        trainer: '1',
      },
      opts({ Authorization: `Bearer ${accessToken}` })
    );
    return { externalId: String(activity.id), url: `https://www.strava.com/activities/${activity.id}` };
  },

  async revoke({ refreshToken }) {
    const basic = Buffer.from(`${env.strava.clientId}:${env.strava.clientSecret}`).toString('base64');
    await postForm(REVOKE_URL, { token: refreshToken, token_type_hint: 'refresh_token' }, opts({ Authorization: `Basic ${basic}` }));
  },
};
