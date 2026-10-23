const Joi = require('joi');
const { ROLES } = require('../config/roles');
const { name, email, password } = require('./auth.validator');

const objectId = Joi.string().hex().length(24);
const manageableRoles = [ROLES.MEMBER, ROLES.TRAINER, ROLES.STAFF];

const updateMe = Joi.object({ name }).min(1);

const createUser = Joi.object({
  name: name.required(),
  email: email.required(),
  password: password.required(),
  role: Joi.string().valid(...manageableRoles).required(),
});

const listQuery = Joi.object({
  role: Joi.string().valid(...manageableRoles),
});

const idParam = Joi.object({ id: objectId.required() });

const assignTrainer = Joi.object({
  trainerId: objectId.allow(null).required(),
});

module.exports = { updateMe, createUser, listQuery, idParam, assignTrainer };
