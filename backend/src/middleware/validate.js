const ApiError = require('../utils/ApiError');

// schemas: { body?, query?, params? } of Joi schemas. Validated values land on req.valid.
const validate = (schemas) => (req, _res, next) => {
  req.valid = req.valid || {};
  for (const [part, schema] of Object.entries(schemas)) {
    const { value, error } = schema.validate(req[part] ?? {}, { abortEarly: false, stripUnknown: true });
    if (error) {
      throw ApiError.badRequest(
        'Validation failed',
        error.details.map((d) => ({ field: d.path.join('.'), message: d.message }))
      );
    }
    req.valid[part] = value;
  }
  next();
};

module.exports = validate;
