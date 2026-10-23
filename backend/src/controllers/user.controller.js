const bcrypt = require('bcrypt');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');
const { BCRYPT_ROUNDS } = require('./auth.controller');
const RefreshToken = require('../models/RefreshToken');
const { saveImage, removeQuietly } = require('../storage');
const { setAuthCookies } = require('../utils/tokens');

const AVATAR_SIZE = 512;

// Profile responses carry the trainer as a person, matching what /auth/me returns.
const withTrainer = (user) => user.populate('trainer', 'name email avatarKey');

// Which account roles the caller is allowed to list or create.
function manageableRoles(role) {
  const roles = [];
  if (can(role, PERMISSIONS.MEMBERS_MANAGE)) roles.push(ROLES.MEMBER);
  if (can(role, PERMISSIONS.TRAINERS_MANAGE)) roles.push(ROLES.TRAINER, ROLES.STAFF);
  return roles;
}

async function updateMe(req, res) {
  Object.assign(req.user, req.valid.body);
  await req.user.save();
  res.json({ user: await withTrainer(req.user) });
}

async function uploadAvatar(req, res) {
  const key = await saveImage(req.file, { gymId: req.user.gym, folder: 'avatars', size: AVATAR_SIZE });
  const previous = req.user.avatarKey;
  req.user.avatarKey = key;
  await req.user.save();
  await removeQuietly(previous);
  res.json({ user: await withTrainer(req.user) });
}

async function removeAvatar(req, res) {
  const previous = req.user.avatarKey;
  req.user.avatarKey = null;
  await req.user.save();
  await removeQuietly(previous);
  res.json({ user: await withTrainer(req.user) });
}

// Signs out every other device, then starts a fresh session here so this one stays signed in.
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw ApiError.badRequest('Your current password is not correct');
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  await setAuthCookies(res, user);
  res.status(204).end();
}

async function listUsers(req, res) {
  const allowed = manageableRoles(req.user.role);
  const { role } = req.valid.query;
  if (role && !allowed.includes(role)) throw ApiError.forbidden();

  const users = await User.find({ gym: req.user.gym, role: role || { $in: allowed } })
    .populate('trainer', 'name email avatarKey')
    .sort({ createdAt: -1 });
  res.json({ users });
}

async function createUser(req, res) {
  const { name, email, password, role } = req.valid.body;
  if (!manageableRoles(req.user.role).includes(role)) throw ApiError.forbidden();
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    name,
    email,
    role,
    gym: req.user.gym,
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
  });
  res.status(201).json({ user });
}

async function listClients(req, res) {
  const filter = { gym: req.user.gym, role: ROLES.MEMBER };
  // Trainers only ever see the members assigned to them.
  if (req.user.role === ROLES.TRAINER) filter.trainer = req.user._id;
  else filter.trainer = { $ne: null };

  const clients = await User.find(filter).populate('trainer', 'name email avatarKey').sort({ name: 1 });
  res.json({ clients });
}

async function assignTrainer(req, res) {
  const { trainerId } = req.valid.body;

  // Scoping both lookups to the caller's gym is what stops cross-gym assignment.
  const member = await User.findOne({ _id: req.valid.params.id, gym: req.user.gym, role: ROLES.MEMBER });
  if (!member) throw ApiError.notFound('Member not found');

  if (trainerId) {
    const trainer = await User.exists({ _id: trainerId, gym: req.user.gym, role: ROLES.TRAINER, isActive: true });
    if (!trainer) throw ApiError.badRequest('Trainer not found in this gym');
  }

  member.trainer = trainerId;
  await member.save();
  await member.populate('trainer', 'name email avatarKey');
  res.json({ user: member });
}

module.exports = { updateMe, uploadAvatar, removeAvatar, changePassword, listUsers, createUser, listClients, assignTrainer };
