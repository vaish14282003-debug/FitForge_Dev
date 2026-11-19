const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const IntegrationConnection = require('../models/IntegrationConnection');
const WorkoutSession = require('../models/WorkoutSession');
const registry = require('../integrations/registry');
const integrations = require('../integrations/service');

// The OAuth round trip is protected twice: `state` is signed and names the FitForge user and the
// provider, and its nonce must match a cookie set in the browser that started it. So nobody can
// trick someone into linking an outside account to the wrong FitForge account.
const STATE_COOKIE = 'ff_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;
const stateCookieOptions = { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/api/integrations' };

const backToProfile = (res, provider, outcome) =>
  res.redirect(303, `${env.appUrl.replace(/\/$/, '')}/profile?integration=${provider}&result=${outcome}`);

/** The provider named in the URL, if the server offers it. */
function availableProvider(id) {
  const provider = registry.get(id);
  if (!provider) throw ApiError.notFound('Unknown integration');
  if (!integrations.isAvailable(provider)) throw new ApiError(503, `${provider.name} is not set up on this server`);
  return provider;
}

// Providers this server offers, with the member's connection to each.
async function list(req, res) {
  const providers = integrations.available();
  const connections = await IntegrationConnection.find({ user: req.user._id, provider: { $in: providers.map((p) => p.id) } });
  res.json({
    integrations: providers.map((p) => ({
      provider: p.id,
      name: p.name,
      connection: connections.find((c) => c.provider === p.id) ?? null,
    })),
  });
}

async function startConnect(req, res) {
  const provider = availableProvider(req.valid.params.provider);
  const nonce = crypto.randomBytes(16).toString('base64url');
  const state = jwt.sign({ sub: req.user.id, provider: provider.id, nonce, purpose: 'integration-connect' }, env.jwtAccessSecret, {
    expiresIn: STATE_TTL_SECONDS,
  });
  res.cookie(STATE_COOKIE, nonce, { ...stateCookieOptions, maxAge: STATE_TTL_SECONDS * 1000 });
  res.json({ url: provider.authorizeUrl({ redirectUri: integrations.redirectUri(provider), state }) });
}

// The provider sends the browser here after the member approves or declines. Always ends on Profile.
async function callback(req, res) {
  const id = req.valid.params.provider;
  const { code, scope, state, error } = req.valid.query;
  const nonce = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, stateCookieOptions);

  const provider = registry.get(id);
  if (!provider || !integrations.isAvailable(provider)) return backToProfile(res, id, 'unavailable');
  if (error) return backToProfile(res, id, 'denied');

  let payload;
  try {
    payload = jwt.verify(state || '', env.jwtAccessSecret);
  } catch {
    return backToProfile(res, id, 'expired');
  }
  const valid = payload.purpose === 'integration-connect' && payload.provider === id && nonce && payload.nonce === nonce && code;
  if (!valid) return backToProfile(res, id, 'expired');
  // e.g. unticking "upload activities" on Strava's screen leaves nothing for FitForge to do.
  if (!provider.hasRequiredScope(scope)) return backToProfile(res, id, 'missing-permission');

  try {
    await integrations.connect(payload.sub, provider, code);
  } catch (err) {
    logger.warn(`${provider.name} connect failed for user ${payload.sub}: ${err.message}`);
    return backToProfile(res, id, 'error');
  }
  backToProfile(res, id, 'connected');
}

async function updateSettings(req, res) {
  const provider = availableProvider(req.valid.params.provider);
  const connection = await IntegrationConnection.findOneAndUpdate(
    { user: req.user._id, provider: provider.id },
    { autoUpload: req.valid.body.autoUpload },
    { new: true }
  );
  if (!connection) throw ApiError.notFound(`${provider.name} is not connected`);
  res.json({ connection });
}

async function disconnect(req, res) {
  const provider = registry.get(req.valid.params.provider);
  if (!provider) throw ApiError.notFound('Unknown integration');
  await integrations.disconnect(req.user._id, provider);
  res.status(204).end();
}

// "Send to …" for a workout that wasn't uploaded (older, failed, or auto-upload off).
async function uploadOne(req, res) {
  const provider = availableProvider(req.valid.params.provider);
  const connection = await IntegrationConnection.findOne({ user: req.user._id, provider: provider.id });
  if (!connection) throw ApiError.badRequest(`Connect ${provider.name} first`);
  const session = await WorkoutSession.findOne({ _id: req.valid.params.id, member: req.user._id });
  if (!session) throw ApiError.notFound('Workout not found');
  if (session.exports?.some((e) => e.provider === provider.id && e.status === 'uploaded')) return res.json({ session });
  await integrations.uploadSession(session, connection);
  res.json({ session });
}

module.exports = { list, startConnect, callback, updateSettings, disconnect, uploadOne, STATE_COOKIE };
