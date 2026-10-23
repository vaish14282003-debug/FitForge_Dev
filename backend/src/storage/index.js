const crypto = require('crypto');
const sharp = require('sharp');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { createLocalStorage } = require('./local');
const { createS3Storage } = require('./s3');

const storage = env.storage.driver === 's3' ? createS3Storage(env.storage.s3) : createLocalStorage(env.storage.uploadDir);

// Every key starts with the gym, which is how file access stays inside one gym.
const gymPrefix = (gymId) => `gyms/${gymId}/`;

/**
 * Decodes the upload as an image (rejecting anything that isn't one, whatever its extension
 * claims), strips metadata such as GPS, resizes it and stores it as WebP. Returns the key.
 */
async function saveImage(file, { gymId, folder, size }) {
  let body;
  try {
    body = await sharp(file.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(size, size, { fit: folder === 'avatars' ? 'cover' : 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw ApiError.badRequest('That file is not a readable image. Use a JPG, PNG or WebP.');
  }
  const key = `${gymPrefix(gymId)}${folder}/${crypto.randomUUID()}.webp`;
  await storage.put(key, body, 'image/webp');
  return key;
}

/** Best-effort delete of a replaced file; a leftover file is not worth failing the request over. */
async function removeQuietly(key) {
  if (!key) return;
  try {
    await storage.remove(key);
  } catch {
    // Ignored on purpose.
  }
}

/** The URL the frontend uses: our own endpoint, which checks the gym before serving or signing. */
const fileUrl = (key) => (key ? `/api/files/${key}` : null);

module.exports = { storage, saveImage, removeQuietly, fileUrl, gymPrefix };
