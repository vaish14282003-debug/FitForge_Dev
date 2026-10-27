const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize, authorizeAny } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/user.validator');
const { singleImage } = require('../middleware/upload');
const controller = require('../controllers/user.controller');

const router = Router();
router.use(authenticate);

const manageAny = authorizeAny(P.MEMBERS_MANAGE, P.TRAINERS_MANAGE);

router.patch('/me', authorize(P.PROFILE_UPDATE_OWN), validate({ body: schemas.updateMe }), controller.updateMe);
router.post('/me/avatar', authorize(P.PROFILE_UPDATE_OWN), singleImage('avatar'), controller.uploadAvatar);
router.delete('/me/avatar', authorize(P.PROFILE_UPDATE_OWN), controller.removeAvatar);
router.post('/me/password', authorize(P.PROFILE_UPDATE_OWN), validate({ body: schemas.changePassword }), controller.changePassword);
router.get('/clients', authorize(P.CLIENTS_READ_ASSIGNED), controller.listClients);
router.get('/', manageAny, validate({ query: schemas.listQuery }), controller.listUsers);
router.post('/', manageAny, validate({ body: schemas.createUser }), controller.createUser);
router.patch('/:id', manageAny, validate({ params: schemas.idParam, body: schemas.updateUser }), controller.updateUser);
router.patch(
  '/:id/trainer',
  authorize(P.MEMBERS_MANAGE),
  validate({ params: schemas.idParam, body: schemas.assignTrainer }),
  controller.assignTrainer
);

module.exports = router;
