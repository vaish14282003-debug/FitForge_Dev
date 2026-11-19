const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const { reportError } = require('../services/errorReporter');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'That value is already in use' });
  }
  logger.error(err);
  reportError(err, { request: { method: req.method, path: req.baseUrl + req.path }, userId: req.user?.id });
  res.status(500).json({ message: 'Something went wrong' });
}

module.exports = { notFound, errorHandler };
