const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize, authorizeAny } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/progress.validator');
const controller = require('../controllers/progress.controller');

const router = Router();
router.use(authenticate);

// Members read their own progress; trainers and owners read a member's with ?member=.
const reader = authorizeAny(P.WORKOUT_LOG, P.CLIENTS_READ_ASSIGNED);
const owner = authorize(P.WORKOUT_LOG);

router.get('/metrics', reader, validate({ query: schemas.memberQuery }), controller.listMetrics);
router.put('/metrics', owner, validate({ body: schemas.upsertMetric }), controller.upsertMetric);
router.delete('/metrics/:id', owner, validate({ params: schemas.idParam }), controller.deleteMetric);
router.put('/goal', owner, validate({ body: schemas.goal }), controller.setGoal);
router.get('/training', reader, validate({ query: schemas.trainingQuery }), controller.getTraining);
router.get('/strength', reader, validate({ query: schemas.strengthQuery }), controller.getStrength);

module.exports = router;
