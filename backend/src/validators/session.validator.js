const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createSession = Joi.object({
  planId: objectId.required(),
  dayIndex: Joi.number().integer().min(0).max(6).required(),
  startedAt: Joi.date().iso().required(),
  notes: Joi.string().trim().max(500).allow('').default(''),
  entries: Joi.array()
    .items(
      Joi.object({
        exercise: objectId.required(),
        sets: Joi.array()
          .items(
            Joi.object({
              reps: Joi.number().integer().min(0).max(200).required(),
              weight: Joi.number().min(0).max(1000).allow(null).default(null),
              done: Joi.boolean().default(true),
            })
          )
          .min(1)
          .max(20)
          .required(),
      })
    )
    .min(1)
    .max(20)
    .required(),
});

const listQuery = Joi.object({
  member: objectId,
  pendingReview: Joi.boolean(),
  limit: Joi.number().integer().min(1).max(100).default(30),
});

// Browser timezone offset (Date#getTimezoneOffset), so "today" and streaks follow the member's clock.
const summaryQuery = Joi.object({ tz: Joi.number().integer().min(-840).max(840).default(0) });

const previousQuery = Joi.object({
  exercises: Joi.string()
    .pattern(/^[a-f0-9]{24}(,[a-f0-9]{24}){0,19}$/)
    .required(),
});

const idParam = Joi.object({ id: objectId.required() });

const review = Joi.object({ comment: Joi.string().trim().min(1).max(500).required() });

module.exports = { createSession, listQuery, summaryQuery, previousQuery, idParam, review };
