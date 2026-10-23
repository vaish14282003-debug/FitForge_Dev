const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).messages({ 'string.pattern.base': 'Times look like 07:30' });
const tz = Joi.number().integer().min(-840).max(840).default(0);
const day = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

const availability = Joi.object({
  weekly: Joi.array()
    .items(Joi.object({ day: Joi.number().integer().min(0).max(6).required(), start: time.required(), end: time.required() }))
    .max(21)
    .required(),
  sessionMinutes: Joi.number().valid(30, 45, 60, 90).required(),
});

const trainerQuery = Joi.object({ trainer: objectId });
const slotsQuery = Joi.object({ trainer: objectId, from: day, days: Joi.number().integer().min(1).max(21).default(7), tz });
const book = Joi.object({ startsAt: Joi.date().iso().required(), memberId: objectId, notes: Joi.string().trim().max(300).allow('').default(''), tz });
const rangeQuery = Joi.object({ from: Joi.date().iso(), to: Joi.date().iso(), member: objectId });
const status = Joi.object({ status: Joi.string().valid('COMPLETED', 'NO_SHOW').required() });

const createClass = Joi.object({
  title: Joi.string().trim().min(2).max(60).required(),
  description: Joi.string().trim().max(300).allow('').default(''),
  location: Joi.string().trim().max(60).allow('').default(''),
  trainerId: objectId.allow(null),
  startsAt: Joi.date().iso().required(),
  durationMinutes: Joi.number().integer().min(15).max(240).required(),
  capacity: Joi.number().integer().min(1).max(200).required(),
  repeatWeeks: Joi.number().integer().min(1).max(12).default(1),
});

const idParam = Joi.object({ id: objectId.required() });

module.exports = { availability, trainerQuery, slotsQuery, book, rangeQuery, status, createClass, idParam };
