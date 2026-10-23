const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const RefreshToken = require('../models/RefreshToken');

const ACCESS_COOKIE = 'ff_access';
const REFRESH_COOKIE = 'ff_refresh';
// Carries no secret. It only tells the frontend's route proxy that a session probably exists,
// because the refresh cookie itself is never sent on page requests.
const SESSION_COOKIE = 'ff_session';

const accessMaxAgeMs = env.accessTokenTtlMinutes * 60 * 1000;
const refreshMaxAgeMs = env.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

const baseCookie = { httpOnly: true, secure: env.isProd, sameSite: 'lax' };
const accessCookieOptions = { ...baseCookie, path: '/' };
// The refresh token is only ever sent to the auth endpoints.
const refreshCookieOptions = { ...baseCookie, path: '/api/auth' };

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.accessTokenTtlMinutes * 60,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + refreshMaxAgeMs),
  });
  return token;
}

async function setAuthCookies(res, user) {
  res.cookie(ACCESS_COOKIE, signAccessToken(user), { ...accessCookieOptions, maxAge: accessMaxAgeMs });
  res.cookie(REFRESH_COOKIE, await issueRefreshToken(user.id), { ...refreshCookieOptions, maxAge: refreshMaxAgeMs });
  res.cookie(SESSION_COOKIE, '1', { ...accessCookieOptions, maxAge: refreshMaxAgeMs });
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, accessCookieOptions);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.clearCookie(SESSION_COOKIE, accessCookieOptions);
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  setAuthCookies,
  clearAuthCookies,
};
