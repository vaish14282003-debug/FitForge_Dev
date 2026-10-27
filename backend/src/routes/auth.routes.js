const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const schemas = require('../validators/auth.validator');
const controller = require('../controllers/auth.controller');

const router = Router();

// Slows down credential stuffing and sign-up abuse.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { message: 'Too many attempts, please try again later' },
});

router.post('/register', credentialLimiter, validate({ body: schemas.register }), controller.register);
router.post('/login', credentialLimiter, validate({ body: schemas.login }), controller.login);
router.post('/forgot-password', credentialLimiter, validate({ body: schemas.forgotPassword }), controller.forgotPassword);
router.post('/reset-password', credentialLimiter, validate({ body: schemas.resetPassword }), controller.resetPassword);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);

module.exports = router;
