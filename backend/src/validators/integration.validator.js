const Joi = require('joi');

const provider = Joi.string().pattern(/^[a-z][a-z0-9-]*$/).max(40).required();

const providerParam = Joi.object({ provider });
const sessionParams = Joi.object({ provider, id: Joi.string().hex().length(24).required() });

// Providers add these to the callback URL; anything else is ignored.
const callbackQuery = Joi.object({
  code: Joi.string().max(500),
  scope: Joi.string().max(500).allow(''),
  state: Joi.string().max(2000),
  error: Joi.string().max(100),
}).unknown(true);

const settings = Joi.object({ autoUpload: Joi.boolean().required() });

module.exports = { providerParam, sessionParams, callbackQuery, settings };
