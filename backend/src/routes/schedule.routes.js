const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize, authorizeAny } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/schedule.validator');
const controller = require('../controllers/schedule.controller');

const router = Router();
router.use(authenticate);

// Members book their own trainer; trainers manage their hours, clients and classes; owners see everything.
const training = authorizeAny(P.WORKOUT_LOG, P.WORKOUT_CREATE);
const byId = validate({ params: schemas.idParam });

router.get('/availability', training, validate({ query: schemas.trainerQuery }), controller.getAvailability);
router.put('/availability', authorize(P.WORKOUT_CREATE), validate({ body: schemas.availability }), controller.setAvailability);
router.get('/slots', training, validate({ query: schemas.slotsQuery }), controller.getSlots);

router.get('/bookings', training, validate({ query: schemas.rangeQuery }), controller.listBookings);
router.post('/bookings', training, validate({ body: schemas.book }), controller.createBooking);
router.post('/bookings/:id/cancel', training, byId, controller.cancelBooking);
router.patch('/bookings/:id/status', authorize(P.WORKOUT_CREATE), byId, validate({ body: schemas.status }), controller.setBookingStatus);

router.get('/classes', validate({ query: schemas.rangeQuery }), controller.listClasses);
router.post('/classes', authorize(P.WORKOUT_CREATE), validate({ body: schemas.createClass }), controller.createClass);
router.post('/classes/:id/join', authorize(P.WORKOUT_LOG), byId, controller.joinClass);
router.post('/classes/:id/leave', authorize(P.WORKOUT_LOG), byId, controller.leaveClass);
router.post('/classes/:id/cancel', authorize(P.WORKOUT_CREATE), byId, controller.cancelClass);

module.exports = router;
