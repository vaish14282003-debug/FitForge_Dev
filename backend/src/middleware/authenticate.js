const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ACCESS_COOKIE, verifyAccessToken } = require('../utils/tokens');

function readToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[ACCESS_COOKIE];
}

// Loads the user fresh on every request so role changes and deactivation apply immediately,
// rather than trusting the role baked into a token that may be minutes old.
async function authenticate(req, _res, next) {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Session expired');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized();

  req.user = user;
  next();
}

module.exports = authenticate;
