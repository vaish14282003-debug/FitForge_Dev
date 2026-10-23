const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/membership.validator');
const controller = require('../controllers/membership.controller');

const plans = Router();
plans.use(authenticate);
plans.get('/', controller.listPlans);
// Prices are a gym setting: owners only. Selling plans is open to the front desk (below).
plans.post('/', authorize(P.GYM_SETTINGS), validate({ body: schemas.createPlan }), controller.createPlan);
plans.patch('/:id', authorize(P.GYM_SETTINGS), validate({ params: schemas.idParam, body: schemas.updatePlan }), controller.updatePlan);

const memberships = Router();
memberships.use(authenticate);
const manage = authorize(P.MEMBERSHIPS_MANAGE);
const byId = validate({ params: schemas.idParam });

memberships.get('/me', authorize(P.WORKOUT_LOG), validate({ query: schemas.tzQuery }), controller.getMine);
memberships.get('/overview', manage, validate({ query: schemas.tzQuery }), controller.getOverview);
memberships.get('/roster', manage, validate({ query: schemas.tzQuery }), controller.getRoster);
memberships.get('/', manage, validate({ query: schemas.listQuery }), controller.listMemberships);
memberships.post('/', manage, validate({ body: schemas.createMembership }), controller.createMembership);
memberships.post('/:id/renew', manage, byId, validate({ body: schemas.renew }), controller.renewMembership);
memberships.patch('/:id/payment', manage, byId, validate({ body: schemas.markPaid }), controller.markPaid);
memberships.post('/:id/cancel', manage, byId, controller.cancelMembership);

module.exports = { plans, memberships };
