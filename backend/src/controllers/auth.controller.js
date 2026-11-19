const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Gym = require('../models/Gym');
const RefreshToken = require('../models/RefreshToken');
const PasswordReset = require('../models/PasswordReset');
const env = require('../config/env');
const { sendMail } = require('../services/mailer');
const { passwordResetEmail } = require('../services/emailTemplates');
const { isDemoAccount } = require('../config/demo');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { ROLES, permissionsFor } = require('../config/roles');
const { REFRESH_COOKIE, hashToken, setAuthCookies, clearAuthCookies } = require('../utils/tokens');

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync('fitforge-dummy-password', BCRYPT_ROUNDS);

async function sessionPayload(user) {
  await user.populate('trainer', 'name email avatarKey');
  return { user, permissions: permissionsFor(user.role) };
}

async function register(req, res) {
  const { name, email, password, role, gymName, gymCode } = req.valid.body;

  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  if (env.isLive && isDemoAccount(email)) throw ApiError.badRequest('That email address is reserved for demo accounts');

  const user = new User({ name, email, role, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });

  if (role === ROLES.GYM_OWNER) {
    const gym = new Gym({ name: gymName, owner: user._id });
    user.gym = gym._id;
    await user.save();
    try {
      await gym.save();
    } catch (err) {
      // No multi-document transactions on a standalone MongoDB, so undo by hand.
      await User.deleteOne({ _id: user._id });
      throw err;
    }
  } else {
    const gym = await Gym.findOne({ joinCode: gymCode });
    if (!gym) throw ApiError.badRequest("No gym uses that code. Check it with your gym, or choose 'I own a gym' to create one.");
    user.gym = gym._id;
    await user.save();
  }

  await setAuthCookies(res, user);
  res.status(201).json(await sessionPayload(user));
}

async function login(req, res) {
  const { email, password } = req.valid.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  // Demo accounts share a public password, so a live deployment never lets them in.
  if (!user || !passwordOk || (env.isLive && isDemoAccount(user.email))) throw ApiError.unauthorized('Incorrect email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  await setAuthCookies(res, user);
  res.json(await sessionPayload(user));
}

async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized();

  // Atomically claim the token so two concurrent refreshes cannot both rotate it.
  const stored = await RefreshToken.findOneAndUpdate(
    { tokenHash: hashToken(token), revokedAt: null, expiresAt: { $gt: new Date() } },
    { revokedAt: new Date() }
  );

  if (!stored) {
    // A token we already rotated is being replayed: treat the whole session family as stolen.
    const replayed = await RefreshToken.findOne({ tokenHash: hashToken(token) });
    if (replayed) {
      logger.warn(`Refresh token reuse detected for user ${replayed.user}`);
      await RefreshToken.updateMany({ user: replayed.user, revokedAt: null }, { revokedAt: new Date() });
    }
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session expired');
  }

  const user = await User.findById(stored.user);
  if (!user || !user.isActive) {
    clearAuthCookies(res);
    throw ApiError.unauthorized();
  }

  await setAuthCookies(res, user);
  res.json(await sessionPayload(user));
}

async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await RefreshToken.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { revokedAt: new Date() });
  }
  clearAuthCookies(res);
  res.status(204).end();
}

async function me(req, res) {
  res.json(await sessionPayload(req.user));
}

const RESET_MINUTES = 30;

// Always answers the same way, so it can't be used to find out which emails have accounts.
async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.valid.body.email, isActive: true });
  if (user) {
    const token = crypto.randomBytes(32).toString('base64url');
    await PasswordReset.create({ user: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000) });
    const link = `${env.appUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
    try {
      await sendMail({ to: user.email, ...passwordResetEmail({ name: user.name, link, minutes: RESET_MINUTES }) });
    } catch (err) {
      logger.error(err);
    }
  }
  res.json({ message: 'If an account uses that email, a reset link is on its way.' });
}

async function resetPassword(req, res) {
  const { token, password } = req.valid.body;
  // Claim the token atomically so it can only ever be used once.
  const reset = await PasswordReset.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() }
  );
  if (!reset) throw ApiError.badRequest('This reset link is invalid or has expired. Ask for a new one.');
  const user = await User.findById(reset.user);
  if (!user || !user.isActive) throw ApiError.badRequest('This reset link is invalid or has expired. Ask for a new one.');

  user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await user.save();
  // Every existing session and any other outstanding reset link stops working.
  await Promise.all([
    RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() }),
    PasswordReset.updateMany({ user: user._id, usedAt: null }, { usedAt: new Date() }),
  ]);
  res.json({ message: 'Password updated. You can log in with it now.' });
}

module.exports = { register, login, refresh, logout, me, forgotPassword, resetPassword, BCRYPT_ROUNDS };
