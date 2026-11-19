const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/integration.validator');
const controller = require('../controllers/integration.controller');

// Mounted at /api/integrations. Connected fitness services (Strava…), for people who log workouts.
const router = Router();
const member = [authenticate, authorize(P.WORKOUT_LOG)];
const byProvider = validate({ params: schemas.providerParam });

// No session check here: the provider redirects the browser, and the signed state names the user.
router.get('/:provider/callback', byProvider, validate({ query: schemas.callbackQuery }), controller.callback);

router.get('/', ...member, controller.list);
router.post('/:provider/connect', ...member, byProvider, controller.startConnect);
router.patch('/:provider', ...member, byProvider, validate({ body: schemas.settings }), controller.updateSettings);
router.delete('/:provider', ...member, byProvider, controller.disconnect);
router.post('/:provider/sessions/:id', ...member, validate({ params: schemas.sessionParams }), controller.uploadOne);

module.exports = router;
