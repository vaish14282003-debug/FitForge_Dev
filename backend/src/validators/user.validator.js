const Joi = require('joi');
const { ROLES } = require('../config/roles');
const { FITNESS_GOALS } = require('../models/User');
const { name, email, password } = require('./auth.validator');

const objectId = Joi.string().hex().length(24);
const manageableRoles = [ROLES.MEMBER, ROLES.TRAINER, ROLES.STAFF];

const updateMe = Joi.object({
  name,
  phone: Joi.string()
    .trim()
    .pattern(/^\+?[0-9 ()-]{7,20}$/)
    .allow('')
    .messages({ 'string.pattern.base': 'Enter a valid phone number' }),
  bio: Joi.string().trim().max(300).allow(''),
  heightCm: Joi.number().integer().min(100).max(250).allow(null),
  dateOfBirth: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow(null),
  fitnessGoal: Joi.string()
    .valid(...FITNESS_GOALS)
    .allow(null),
}).min(1);

const changePassword = Joi.object({
  currentPassword: Joi.string().max(72).required(),
  newPassword: password.required().invalid(Joi.ref('currentPassword')).messages({ 'any.invalid': 'Choose a password different from your current one' }),
});

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

const updateUser = Joi.object({
  name,
  phone: Joi.string()
    .trim()
    .pattern(/^\+?[0-9 ()-]{7,20}$/)
    .allow('')
    .messages({ 'string.pattern.base': 'Enter a valid phone number' }),
  isActive: Joi.boolean(),
}).min(1);

module.exports = { updateMe, changePassword, createUser, listQuery, idParam, assignTrainer, updateUser };
