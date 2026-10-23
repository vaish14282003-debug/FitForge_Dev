const multer = require('multer');
const ApiError = require('../utils/ApiError');

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest('Upload a JPG, PNG or WebP image.'));
  },
});

/** Accepts one image in `field`; turns Multer's errors into the API's usual 400s. */
const singleImage = (field) => (req, res, next) =>
  imageUpload.single(field)(req, res, (err) => {
    if (!err) {
      if (!req.file) return next(ApiError.badRequest(`Attach an image in the "${field}" field.`));
      return next();
    }
    if (err instanceof ApiError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') return next(ApiError.badRequest('That image is over 5 MB. Choose a smaller one.'));
    next(ApiError.badRequest(err.message));
  });

module.exports = { singleImage, MAX_BYTES };
