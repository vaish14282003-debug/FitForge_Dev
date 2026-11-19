const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDb, disconnectDb } = require('./config/db');
const { productionWarnings } = require('./config/production');
const { reportError } = require('./services/errorReporter');

// Errors outside a request (a failed timer, a rejected promise nobody awaited) are reported too.
process.on('unhandledRejection', (reason) => {
  logger.error(reason);
  reportError(reason, { tags: { source: 'unhandledRejection' } });
});

// They can't sign in on production (see login), but they shouldn't be in a live database at all.
async function warnAboutDemoAccounts() {
  const User = require('./models/User');
  const { DEMO_EMAIL_DOMAIN } = require('./config/demo');
  const count = await User.countDocuments({ email: { $regex: `@${DEMO_EMAIL_DOMAIN.replace('.', '\\.')}$`, $options: 'i' } });
  if (count) {
    logger.warn(`${count} demo account(s) (@${DEMO_EMAIL_DOMAIN}) are in this production database. Point MONGO_URI at a separate, empty database.`);
  }
}

async function start() {
  if (env.isProd) productionWarnings(env).forEach((w) => logger.warn(w));
  await connectDb();
  if (env.isLive) await warnAboutDemoAccounts();
  const server = app.listen(env.port, () => logger.info(`FitForge API listening on :${env.port}`));

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(async (err) => {
  logger.error(err);
  await reportError(err, { tags: { source: 'startup' } });
  process.exit(1);
});
