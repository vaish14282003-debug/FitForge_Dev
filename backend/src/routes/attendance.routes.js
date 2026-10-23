const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize, authorizeAny } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/attendance.validator');
const controller = require('../controllers/attendance.controller');

const router = Router();
router.use(authenticate);

// The front desk (owners and staff) shows the QR code and checks members in by hand.
const frontDesk = authorize(P.MEMBERS_MANAGE);

router.get('/qr', frontDesk, controller.getQrToken);
router.post('/check-in', authorize(P.WORKOUT_LOG), validate({ body: schemas.qrCheckIn }), controller.qrCheckIn);
router.post('/', frontDesk, validate({ body: schemas.staffCheckIn }), controller.staffCheckIn);
router.get('/stats', frontDesk, validate({ query: schemas.statsQuery }), controller.getStats);
router.get(
  '/summary',
  authorizeAny(P.WORKOUT_LOG, P.CLIENTS_READ_ASSIGNED, P.MEMBERS_MANAGE),
  validate({ query: schemas.summaryQuery }),
  controller.getSummary
);

module.exports = router;
