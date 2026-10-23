const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/workout.validator');
const controller = require('../controllers/plan.controller');

const router = Router();
router.use(authenticate);

const byId = validate({ params: schemas.idParam });

// Reads are scoped in the controller: creators see their plans, members see plans assigned to them.
router.get('/', controller.listPlans);
router.get('/:id', byId, controller.getPlan);
router.post('/', authorize(P.WORKOUT_CREATE), validate({ body: schemas.plan }), controller.createPlan);
router.put('/:id', authorize(P.WORKOUT_CREATE), byId, validate({ body: schemas.plan }), controller.updatePlan);
router.delete('/:id', authorize(P.WORKOUT_CREATE), byId, controller.deletePlan);
router.put(
  '/:id/assignees',
  authorize(P.WORKOUT_ASSIGN),
  byId,
  validate({ body: schemas.assignees }),
  controller.setAssignees
);

module.exports = router;
