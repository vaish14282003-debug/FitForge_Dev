const Joi = require('joi');
const { AUDIENCES } = require('../models/Announcement');

const objectId = Joi.string().hex().length(24);

const listQuery = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(30),
  tz: Joi.number().integer().min(-840).max(840).default(0),
});
const idParam = Joi.object({ id: objectId.required() });
const createAnnouncement = Joi.object({
  title: Joi.string().trim().min(2).max(100).required(),
  body: Joi.string().trim().min(1).max(1000).required(),
  audience: Joi.string().valid(...AUDIENCES).default('EVERYONE'),
  pinned: Joi.boolean().default(false),
});
const message = Joi.object({
  memberIds: Joi.array().items(objectId).min(1).max(200).unique().required(),
  title: Joi.string().trim().min(2).max(100).required(),
  body: Joi.string().trim().max(1000).allow('').default(''),
});

module.exports = { listQuery, idParam, createAnnouncement, message };
