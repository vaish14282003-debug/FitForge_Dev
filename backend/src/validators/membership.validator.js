const Joi = require('joi');
const { PAYMENT_STATUSES, PAYMENT_METHODS } = require('../models/Membership');

const objectId = Joi.string().hex().length(24);
const day = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const tz = Joi.number().integer().min(-840).max(840).default(0);

const createPlan = Joi.object({
  name: Joi.string().trim().min(2).max(60).required(),
  durationMonths: Joi.number().integer().min(1).max(24).required(),
  price: Joi.number().integer().min(0).max(1000000).required(),
  description: Joi.string().trim().max(300).allow('').default(''),
});

const updatePlan = Joi.object({
  name: Joi.string().trim().min(2).max(60),
  price: Joi.number().integer().min(0).max(1000000),
  description: Joi.string().trim().max(300).allow(''),
  isActive: Joi.boolean(),
}).min(1);

// A method is required once money has changed hands.
const payment = Joi.object({
  status: Joi.string().valid(...PAYMENT_STATUSES).required(),
  method: Joi.when('status', {
    is: 'PAID',
    then: Joi.string().valid(...PAYMENT_METHODS).required(),
    otherwise: Joi.string().valid(...PAYMENT_METHODS).allow(null).default(null),
  }),
  reference: Joi.string().trim().max(100).allow('').default(''),
});

const createMembership = Joi.object({
  memberId: objectId.required(),
  planId: objectId.required(),
  startDate: day,
  payment: payment.required(),
  notes: Joi.string().trim().max(300).allow('').default(''),
  tz,
});

const renew = Joi.object({ planId: objectId, payment: payment.required(), notes: Joi.string().trim().max(300).allow('').default(''), tz });

const markPaid = Joi.object({
  method: Joi.string().valid(...PAYMENT_METHODS).required(),
  reference: Joi.string().trim().max(100).allow('').default(''),
});

const listQuery = Joi.object({ member: objectId, tz });
const tzQuery = Joi.object({ tz });
const idParam = Joi.object({ id: objectId.required() });

module.exports = { createPlan, updatePlan, createMembership, renew, markPaid, listQuery, tzQuery, idParam };
