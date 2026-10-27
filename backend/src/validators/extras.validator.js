const Joi = require('joi');
const { MEALS } = require('../models/NutritionLog');

const objectId = Joi.string().hex().length(24);
const day = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const tz = Joi.number().integer().min(-840).max(840).default(0);

const idParam = Joi.object({ id: objectId.required() });
const noteParams = Joi.object({ id: objectId.required(), noteId: objectId.required() });
const note = Joi.object({ body: Joi.string().trim().min(1).max(1000).required() });

// Multipart forms send arrays as a comma-separated string.
const resource = Joi.object({
  title: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(300).allow('').default(''),
  memberIds: Joi.alternatives(
    Joi.array().items(objectId).max(200).unique(),
    Joi.string()
      .allow('')
      .custom((v, h) => {
        const ids = v.split(',').map((s) => s.trim()).filter(Boolean);
        return ids.every((id) => /^[a-f0-9]{24}$/.test(id)) ? ids : h.error('any.invalid');
      })
  ),
});

const nutritionQuery = Joi.object({ day, member: objectId, tz });
const goals = Joi.object({
  calories: Joi.number().integer().min(800).max(6000).allow(null),
  protein: Joi.number().integer().min(0).max(500).allow(null),
  carbs: Joi.number().integer().min(0).max(1000).allow(null),
  fat: Joi.number().integer().min(0).max(500).allow(null),
  waterMl: Joi.number().integer().min(0).max(10000).allow(null),
}).min(1);
const entry = Joi.object({
  day: day.required(),
  meal: Joi.string().valid(...MEALS).required(),
  name: Joi.string().trim().min(1).max(80).required(),
  calories: Joi.number().min(0).max(5000).required(),
  protein: Joi.number().min(0).max(500).default(0),
  carbs: Joi.number().min(0).max(1000).default(0),
  fat: Joi.number().min(0).max(500).default(0),
});
const water = Joi.object({ day: day.required(), waterMl: Joi.number().integer().min(0).max(10000).required() });

const reportQuery = Joi.object({ from: day, to: day, tz });

module.exports = { idParam, noteParams, note, resource, nutritionQuery, goals, entry, water, reportQuery };
