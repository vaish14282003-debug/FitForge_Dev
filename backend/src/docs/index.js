const express = require('express');
const swaggerUiDist = require('swagger-ui-dist');
const openapi = require('./openapi');

// Served by hand rather than through swagger-ui-express: its relative asset paths need a trailing
// slash on /api/docs/, which the Next.js proxy strips, causing a redirect loop. Absolute paths
// work with or without the slash, through the proxy or straight against the API.
const BASE = '/api/docs';

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FitForge API</title>
  <link rel="icon" type="image/png" href="${BASE}/assets/favicon-32x32.png" />
  <link rel="stylesheet" href="${BASE}/assets/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${BASE}/assets/swagger-ui-bundle.js"></script>
  <script src="${BASE}/init.js"></script>
</body>
</html>`;

// A separate file because Helmet's CSP blocks inline scripts.
const init = `window.ui = SwaggerUIBundle({
  url: '${BASE}.json',
  dom_id: '#swagger-ui',
  deepLinking: true,
  tryItOutEnabled: true,
  displayRequestDuration: true,
  persistAuthorization: true,
  withCredentials: true,
});`;

const router = express.Router();
router.get(`${BASE}.json`, (_req, res) => res.json(openapi));
router.use(`${BASE}/assets`, express.static(swaggerUiDist.getAbsoluteFSPath(), { index: false }));
router.get(`${BASE}/init.js`, (_req, res) => res.type('application/javascript').send(init));
router.get(BASE, (_req, res) => res.type('html').send(page));

module.exports = router;
