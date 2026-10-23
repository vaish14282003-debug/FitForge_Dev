const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
const cm = Joi.number().min(10).max(300).allow(null);

const memberQuery = Joi.object({ member: objectId });

const upsertMetric = Joi.object({
  day: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  weight: Joi.number().min(20).max(400).allow(null),
  bodyFat: Joi.number().min(2).max(70).allow(null),
  measurements: Joi.object({ chest: cm, waist: cm, hips: cm, arm: cm, thigh: cm }),
  note: Joi.string().trim().max(200).allow(''),
})
  .or('weight', 'bodyFat', 'measurements')
  .messages({ 'object.missing': 'Log at least a weight, body fat or one measurement' });

const goal = Joi.object({ targetWeight: Joi.number().min(20).max(400).allow(null).required() });

const trainingQuery = Joi.object({
  member: objectId,
  weeks: Joi.number().integer().min(4).max(52).default(12),
  tz: Joi.number().integer().min(-840).max(840).default(0),
});

const strengthQuery = Joi.object({ member: objectId, exercise: objectId.required() });

const idParam = Joi.object({ id: objectId.required() });

module.exports = { memberQuery, upsertMetric, goal, trainingQuery, strengthQuery, idParam };
