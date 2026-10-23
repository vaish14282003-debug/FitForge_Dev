const bcrypt = require('bcrypt');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');
const { BCRYPT_ROUNDS } = require('./auth.controller');

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
  res.json({ user: req.user });
}

async function listUsers(req, res) {
  const allowed = manageableRoles(req.user.role);
  const { role } = req.valid.query;
  if (role && !allowed.includes(role)) throw ApiError.forbidden();

  const users = await User.find({ gym: req.user.gym, role: role || { $in: allowed } })
    .populate('trainer', 'name email')
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

  const clients = await User.find(filter).populate('trainer', 'name email').sort({ name: 1 });
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
  await member.populate('trainer', 'name email');
  res.json({ user: member });
}

module.exports = { updateMe, listUsers, createUser, listClients, assignTrainer };
