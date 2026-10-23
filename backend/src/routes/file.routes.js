const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const ApiError = require('../utils/ApiError');
const { storage, gymPrefix } = require('../storage');

const router = Router();
router.use(authenticate);

// Serves an uploaded file to people signed in to the same gym. Locally the file is streamed;
// with S3 the browser is redirected to a short-lived signed link, so files never sit in a public bucket.
router.get('/*key', async (req, res) => {
  const key = [].concat(req.params.key).join('/');
  if (!key.startsWith(gymPrefix(req.user.gym)) || key.includes('..')) throw ApiError.notFound('File not found');

  if (storage.driver === 's3') {
    const url = await storage.signedUrl(key);
    if (!url) throw ApiError.notFound('File not found');
    res.set('Cache-Control', 'no-store');
    return res.redirect(302, url);
  }

  const file = await storage.locate(key);
  if (!file) throw ApiError.notFound('File not found');
  // Keys are random and never reused, so the browser may cache them for good.
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.sendFile(file);
});

module.exports = router;
