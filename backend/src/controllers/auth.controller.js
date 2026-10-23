const bcrypt = require('bcrypt');
const User = require('../models/User');
const Gym = require('../models/Gym');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { ROLES, permissionsFor } = require('../config/roles');
const { REFRESH_COOKIE, hashToken, setAuthCookies, clearAuthCookies } = require('../utils/tokens');

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync('fitforge-dummy-password', BCRYPT_ROUNDS);

async function sessionPayload(user) {
  await user.populate('trainer', 'name email');
  return { user, permissions: permissionsFor(user.role) };
}

async function register(req, res) {
  const { name, email, password, role, gymName, gymCode } = req.valid.body;

  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');

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
  if (!user || !passwordOk) throw ApiError.unauthorized('Incorrect email or password');
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

module.exports = { register, login, refresh, logout, me, BCRYPT_ROUNDS };
