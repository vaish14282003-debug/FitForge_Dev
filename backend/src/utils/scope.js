const User = require('../models/User');
const ApiError = require('./ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');

/**
 * A member the caller may look after: trainers get their own clients, owners anyone in the gym.
 * Anything else looks like it doesn't exist.
 */
async function findClient(user, memberId) {
  const filter = { _id: memberId, gym: user.gym, role: ROLES.MEMBER };
  if (!can(user.role, PERMISSIONS.GYM_SETTINGS)) filter.trainer = user._id;
  const member = await User.findOne(filter);
  if (!member) throw ApiError.notFound('Member not found');
  return member;
}

module.exports = { findClient };
