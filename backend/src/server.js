const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDb, disconnectDb } = require('./config/db');

async function start() {
  await connectDb();
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

start().catch((err) => {
  logger.error(err);
  process.exit(1);
});
