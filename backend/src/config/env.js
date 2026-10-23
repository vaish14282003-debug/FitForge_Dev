require('dotenv').config({ quiet: true });
const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4000),
  MONGO_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL_MINUTES: Joi.number().integer().min(1).default(15),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(7),
  CLIENT_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
  LOG_LEVEL: Joi.string().default('info'),
}).unknown();

const { value, error } = schema.validate(process.env, { abortEarly: false });
if (error) {
  throw new Error(`Invalid environment configuration: ${error.details.map((d) => d.message).join(', ')}`);
}

module.exports = {
  nodeEnv: value.NODE_ENV,
  isProd: value.NODE_ENV === 'production',
  isTest: value.NODE_ENV === 'test',
  port: value.PORT,
  mongoUri: value.MONGO_URI,
  jwtAccessSecret: value.JWT_ACCESS_SECRET,
  accessTokenTtlMinutes: value.ACCESS_TOKEN_TTL_MINUTES,
  refreshTokenTtlDays: value.REFRESH_TOKEN_TTL_DAYS,
  clientOrigin: value.CLIENT_ORIGIN,
  logLevel: value.LOG_LEVEL,
};
