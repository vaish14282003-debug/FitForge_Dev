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
  // Public address of the website, used in links inside emails (password reset).
  APP_URL: Joi.string().uri().when('NODE_ENV', { is: 'production', then: Joi.required() }),
  // e.g. smtps://user:pass@smtp.example.com:465. Without it, emails are written to the log (dev only).
  SMTP_URL: Joi.string().uri({ scheme: ['smtp', 'smtps'] }).allow(''),
  MAIL_FROM: Joi.string().default('FitForge <no-reply@fitforge.app>'),
  LOG_LEVEL: Joi.string().default('info'),
  // Login/sign-up/reset attempts allowed per IP per 15 minutes. Raise only for automated test runs.
  AUTH_RATE_LIMIT: Joi.number().integer().min(1).default(20),
  // Proxies in front of the API that add X-Forwarded-For. 1 locally (the website); 2 for
  // Vercel -> Render. Too low and every visitor shares one IP for rate limiting.
  TRUST_PROXY: Joi.number().integer().min(0).max(5).default(1),
  // Where uploaded files live: this machine's disk, or an S3 bucket.
  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  UPLOAD_DIR: Joi.string().default('uploads'),
  AWS_REGION: Joi.when('STORAGE_DRIVER', { is: 's3', then: Joi.string().required(), otherwise: Joi.string().allow('') }),
  AWS_S3_BUCKET: Joi.when('STORAGE_DRIVER', { is: 's3', then: Joi.string().required(), otherwise: Joi.string().allow('') }),
  // Optional: without these the AWS SDK uses its usual credential chain (env, profile, instance role).
  AWS_ACCESS_KEY_ID: Joi.string().allow(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow(''),
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
  appUrl: value.APP_URL || value.CLIENT_ORIGIN,
  smtpUrl: value.SMTP_URL,
  mailFrom: value.MAIL_FROM,
  logLevel: value.LOG_LEVEL,
  authRateLimit: value.AUTH_RATE_LIMIT,
  trustProxy: value.TRUST_PROXY,
  storage: {
    driver: value.STORAGE_DRIVER,
    uploadDir: value.UPLOAD_DIR,
    s3: {
      region: value.AWS_REGION,
      bucket: value.AWS_S3_BUCKET,
      accessKeyId: value.AWS_ACCESS_KEY_ID,
      secretAccessKey: value.AWS_SECRET_ACCESS_KEY,
    },
  },
};
