const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const validate = require('../middleware/validate');
const schemas = require('../validators/gym.validator');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const controller = require('../controllers/gym.controller');

const router = Router();

// Public so the sign-up form can confirm a code before submitting. Limited because it confirms
// whether a guessed code exists.
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { message: 'Too many attempts, please try again later' },
});
router.get('/lookup', lookupLimiter, validate({ query: schemas.lookup }), controller.lookupByCode);

router.use(authenticate);

router.get('/', controller.getMyGym);
router.get('/overview', authorize(P.MEMBERS_MANAGE, P.TRAINERS_MANAGE), controller.getOverview);

module.exports = router;
