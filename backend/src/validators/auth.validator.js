const Joi = require('joi');
const { ROLES } = require('../config/roles');

const name = Joi.string().trim().min(2).max(80);
const email = Joi.string().trim().lowercase().email();
// bcrypt ignores everything past 72 bytes, so cap it rather than silently truncate.
const password = Joi.string().min(8).max(72);

// Public sign-up only creates owners (with a new gym) or members (into an existing gym).
// Trainer and staff accounts are created by the gym owner.
const register = Joi.object({
  name: name.required(),
  email: email.required(),
  password: password.required(),
  role: Joi.string().valid(ROLES.GYM_OWNER, ROLES.MEMBER).required(),
  gymName: Joi.when('role', {
    is: ROLES.GYM_OWNER,
    then: Joi.string().trim().min(2).max(120).required(),
    otherwise: Joi.forbidden(),
  }),
  gymCode: Joi.when('role', {
    is: ROLES.MEMBER,
    then: Joi.string().trim().uppercase().length(8).required(),
    otherwise: Joi.forbidden(),
  }),
});

const login = Joi.object({
  email: email.required(),
  password: Joi.string().max(72).required(),
});

module.exports = { name, email, password, register, login };
