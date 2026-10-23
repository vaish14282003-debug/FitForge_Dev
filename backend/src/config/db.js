const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

async function connectDb(uri = env.mongoUri) {
  await mongoose.connect(uri);
  logger.info('MongoDB connected');
}

async function disconnectDb() {
  await mongoose.disconnect();
}

module.exports = { connectDb, disconnectDb };
