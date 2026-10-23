const winston = require('winston');
const env = require('./env');

const logger = winston.createLogger({
  level: env.logLevel,
  silent: env.isTest,
  format: env.isProd
    ? winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => `${timestamp} ${level}: ${stack || message}`)
      ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
