const Joi = require('joi');

const lookup = Joi.object({
  code: Joi.string().trim().uppercase().length(8).required(),
});

module.exports = { lookup };
