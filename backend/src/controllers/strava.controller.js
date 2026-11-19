const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const StravaConnection = require('../models/StravaConnection');
const WorkoutSession = require('../models/WorkoutSession');
const strava = require('../services/strava');

// The OAuth round trip is protected twice: `state` is signed and names the FitForge user, and its
// nonce must match a cookie set in the same browser that started it. So nobody can trick someone
// into linking a Strava account to the wrong FitForge account.
const STATE_COOKIE = 'ff_strava_state';
const STATE_TTL_SECONDS = 10 * 60;
const stateCookieOptions = { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/api/integrations/strava' };

const backToProfile = (res, outcome) => res.redirect(303, `${env.appUrl.replace(/\/$/, '')}/profile?strava=${outcome}`);

function requireAvailable() {
  if (!strava.isAvailable()) throw new ApiError(503, 'Strava is not set up on this server');
}

async function status(req, res) {
  if (!strava.isAvailable()) return res.json({ available: false, connection: null });
  const connection = await StravaConnection.findOne({ user: req.user._id });
  res.json({ available: true, connection });
}

async function startConnect(req, res) {
  requireAvailable();
  const nonce = crypto.randomBytes(16).toString('base64url');
  const state = jwt.sign({ sub: req.user.id, nonce, purpose: 'strava-connect' }, env.jwtAccessSecret, { expiresIn: STATE_TTL_SECONDS });
  res.cookie(STATE_COOKIE, nonce, { ...stateCookieOptions, maxAge: STATE_TTL_SECONDS * 1000 });
  res.json({ url: strava.authorizeUrl(state) });
}

// Strava sends the browser here after the athlete approves or declines. Always ends on the profile.
async function callback(req, res) {
  const { code, scope, state, error } = req.valid.query;
  const nonce = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, stateCookieOptions);

  if (!strava.isAvailable()) return backToProfile(res, 'unavailable');
  if (error) return backToProfile(res, 'denied');

  let payload;
  try {
    payload = jwt.verify(state || '', env.jwtAccessSecret);
  } catch {
    return backToProfile(res, 'expired');
  }
  if (payload.purpose !== 'strava-connect' || !nonce || payload.nonce !== nonce || !code) return backToProfile(res, 'expired');
  // Unchecking "upload activities" on Strava's screen leaves nothing for FitForge to do.
  if (!strava.hasWriteScope(scope)) return backToProfile(res, 'missing-permission');

  try {
    await strava.connect(payload.sub, code);
  } catch (err) {
    logger.warn(`Strava connect failed for user ${payload.sub}: ${err.message}`);
    return backToProfile(res, 'error');
  }
  backToProfile(res, 'connected');
}

async function updateSettings(req, res) {
  requireAvailable();
  const connection = await StravaConnection.findOneAndUpdate({ user: req.user._id }, { autoUpload: req.valid.body.autoUpload }, { new: true });
  if (!connection) throw ApiError.notFound('Strava is not connected');
  res.json({ connection });
}

async function disconnect(req, res) {
  await strava.disconnect(req.user._id);
  res.status(204).end();
}

// "Send to Strava" for a workout that wasn't uploaded (older, failed, or auto-upload off).
async function uploadOne(req, res) {
  requireAvailable();
  const connection = await StravaConnection.findOne({ user: req.user._id });
  if (!connection) throw ApiError.badRequest('Connect Strava first');
  const session = await WorkoutSession.findOne({ _id: req.valid.params.id, member: req.user._id });
  if (!session) throw ApiError.notFound('Workout not found');
  if (session.strava?.status === 'uploaded') return res.json({ session });
  await strava.uploadSession(session, connection);
  res.json({ session });
}

module.exports = { status, startConnect, callback, updateSettings, disconnect, uploadOne, STATE_COOKIE };
