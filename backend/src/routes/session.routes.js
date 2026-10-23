const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize, authorizeAny } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/session.validator');
const controller = require('../controllers/session.controller');

const router = Router();
router.use(authenticate);

const logger = authorize(P.WORKOUT_LOG);
const byId = validate({ params: schemas.idParam });

router.post('/', logger, validate({ body: schemas.createSession }), controller.createSession);
router.get('/summary', logger, validate({ query: schemas.summaryQuery }), controller.getSummary);
router.get('/previous', logger, validate({ query: schemas.previousQuery }), controller.getPrevious);
// Lists are scoped in the controller: members see their own, trainers their clients', owners the gym's.
router.get(
  '/',
  authorizeAny(P.WORKOUT_LOG, P.CLIENTS_READ_ASSIGNED),
  validate({ query: schemas.listQuery }),
  controller.listSessions
);
router.get('/:id', authorizeAny(P.WORKOUT_LOG, P.CLIENTS_READ_ASSIGNED), byId, controller.getSession);
router.patch(
  '/:id/review',
  authorize(P.CLIENTS_READ_ASSIGNED),
  byId,
  validate({ body: schemas.review }),
  controller.reviewSession
);

module.exports = router;
