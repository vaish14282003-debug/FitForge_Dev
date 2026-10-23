const { can } = require('../config/roles');
const ApiError = require('../utils/ApiError');

// Requires every listed permission.
const authorize = (...permissions) => (req, _res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!permissions.every((p) => can(req.user.role, p))) throw ApiError.forbidden();
  next();
};

// Requires at least one of the listed permissions.
const authorizeAny = (...permissions) => (req, _res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (!permissions.some((p) => can(req.user.role, p))) throw ApiError.forbidden();
  next();
};

module.exports = { authorize, authorizeAny };
