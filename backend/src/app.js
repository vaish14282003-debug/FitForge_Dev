const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const logger = require('./config/logger');
const routes = require('./routes');
const docs = require('./docs');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// How many proxies sit in front of us (see TRUST_PROXY), so req.ip is the visitor's real address.
app.set('trust proxy', env.trustProxy);
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Interactive API docs at /api/docs. Same origin as the API, so a login made there
// sets the session cookie and "Try it out" works on protected endpoints.
app.use(docs);

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
