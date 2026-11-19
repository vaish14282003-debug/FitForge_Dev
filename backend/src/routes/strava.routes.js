const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/strava.validator');
const controller = require('../controllers/strava.controller');

// Mounted at /api/integrations/strava. For people who log workouts (members).
const router = Router();
const member = [authenticate, authorize(P.WORKOUT_LOG)];

// No session check here: Strava redirects the browser, and the signed state names the user.
router.get('/callback', validate({ query: schemas.callbackQuery }), controller.callback);

router.get('/', ...member, controller.status);
router.post('/connect', ...member, controller.startConnect);
router.patch('/', ...member, validate({ body: schemas.settings }), controller.updateSettings);
router.delete('/', ...member, controller.disconnect);
router.post('/sessions/:id', ...member, validate({ params: schemas.sessionParam }), controller.uploadOne);

module.exports = router;
