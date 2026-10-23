const Joi = require('joi');
const { MUSCLE_GROUPS, EQUIPMENT } = require('../config/exercise');

const objectId = Joi.string().hex().length(24);

const exerciseQuery = Joi.object({
  muscleGroup: Joi.string().valid(...MUSCLE_GROUPS),
  q: Joi.string().trim().max(80).allow(''),
});

const createExercise = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  muscleGroup: Joi.string().valid(...MUSCLE_GROUPS).required(),
  equipment: Joi.string().valid(...EQUIPMENT).required(),
  instructions: Joi.string().trim().max(1000).allow('').default(''),
});

const planExercise = Joi.object({
  exercise: objectId.required(),
  sets: Joi.number().integer().min(1).max(10).required(),
  reps: Joi.string()
    .trim()
    .pattern(/^\d{1,3}(-\d{1,3})?$/)
    .required()
    .messages({ 'string.pattern.base': 'Reps must be a number like 10 or a range like 8-12' }),
  weight: Joi.number().min(0).max(1000).allow(null).default(null),
  restSeconds: Joi.number().integer().min(0).max(600).default(90),
  notes: Joi.string().trim().max(200).allow('').default(''),
});

const plan = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  description: Joi.string().trim().max(500).allow('').default(''),
  days: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().trim().min(1).max(40).required(),
        exercises: Joi.array().items(planExercise).min(1).max(20).required(),
      })
    )
    .min(1)
    .max(7)
    .required(),
});

const idParam = Joi.object({ id: objectId.required() });

const assignees = Joi.object({
  memberIds: Joi.array().items(objectId).max(200).unique().required(),
});

module.exports = { exerciseQuery, createExercise, plan, idParam, assignees };
