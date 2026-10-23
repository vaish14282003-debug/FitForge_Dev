const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/workout.validator');
const controller = require('../controllers/exercise.controller');
const { singleImage } = require('../middleware/upload');

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: schemas.exerciseQuery }), controller.listExercises);
router.post('/', authorize(P.WORKOUT_CREATE), validate({ body: schemas.createExercise }), controller.createExercise);
router.post(
  '/:id/image',
  authorize(P.WORKOUT_CREATE),
  validate({ params: schemas.idParam }),
  singleImage('image'),
  controller.uploadExerciseImage
);

module.exports = router;
