const Joi = require('joi');

// Strava adds these to the callback URL; anything else is ignored.
const callbackQuery = Joi.object({
  code: Joi.string().max(200),
  scope: Joi.string().max(300).allow(''),
  state: Joi.string().max(2000),
  error: Joi.string().max(100),
}).unknown(true);

const settings = Joi.object({ autoUpload: Joi.boolean().required() });

const sessionParam = Joi.object({ id: Joi.string().hex().length(24).required() });

module.exports = { callbackQuery, settings, sessionParam };
