const Gym = require('../models/Gym');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');

async function getMyGym(req, res) {
  const gym = await Gym.findById(req.user.gym);
  if (!gym) throw ApiError.notFound('Gym not found');

  const data = gym.toJSON();
  // The join code lets anyone sign up as a member, so only settings-level roles see it.
  if (!can(req.user.role, PERMISSIONS.GYM_SETTINGS)) delete data.joinCode;
  res.json({ gym: data });
}

async function getOverview(req, res) {
  const count = (role) => User.countDocuments({ gym: req.user.gym, role, isActive: true });
  const [members, trainers, staff] = await Promise.all([
    count(ROLES.MEMBER),
    count(ROLES.TRAINER),
    count(ROLES.STAFF),
  ]);
  res.json({ overview: { members, trainers, staff } });
}

// Only the name: enough for a member to recognise their gym, nothing an outsider can use.
async function lookupByCode(req, res) {
  const gym = await Gym.findOne({ joinCode: req.valid.query.code }).select('name');
  if (!gym) throw ApiError.notFound('No gym uses that code');
  res.json({ gym: { name: gym.name } });
}

// Invalidates the old code, e.g. after it was shared too widely. Existing members are unaffected.
async function rotateJoinCode(req, res) {
  const gym = await Gym.findById(req.user.gym);
  if (!gym) throw ApiError.notFound('Gym not found');
  gym.joinCode = Gym.generateJoinCode();
  await gym.save();
  res.json({ gym });
}

module.exports = { getMyGym, getOverview, lookupByCode, rotateJoinCode };
