const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize, authorizeAny } = require('../middleware/authorize');
const { singleDocument } = require('../middleware/upload');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/extras.validator');
const clients = require('../controllers/client.controller');
const resources = require('../controllers/resource.controller');
const nutrition = require('../controllers/nutrition.controller');
const reports = require('../controllers/report.controller');

// Private notes about a client: trainers (their own clients) and owners.
const clientRoutes = Router();
clientRoutes.use(authenticate, authorize(P.CLIENTS_READ_ASSIGNED));
clientRoutes.get('/:id/notes', validate({ params: schemas.idParam }), clients.listNotes);
clientRoutes.post('/:id/notes', validate({ params: schemas.idParam, body: schemas.note }), clients.addNote);
clientRoutes.delete('/:id/notes/:noteId', validate({ params: schemas.noteParams }), clients.deleteNote);

// Files trainers share with clients.
const resourceRoutes = Router();
resourceRoutes.use(authenticate);
resourceRoutes.get('/', authorizeAny(P.WORKOUT_LOG, P.WORKOUT_CREATE), resources.listResources);
resourceRoutes.post('/', authorize(P.WORKOUT_CREATE), singleDocument('file'), validate({ body: schemas.resource }), resources.createResource);
resourceRoutes.get('/:id/file', authorizeAny(P.WORKOUT_LOG, P.WORKOUT_CREATE), validate({ params: schemas.idParam }), resources.downloadResource);
resourceRoutes.delete('/:id', authorize(P.WORKOUT_CREATE), validate({ params: schemas.idParam }), resources.deleteResource);

// Members log their own food and water; trainers and owners read a client's with ?member=.
const nutritionRoutes = Router();
nutritionRoutes.use(authenticate);
nutritionRoutes.get('/', authorizeAny(P.WORKOUT_LOG, P.CLIENTS_READ_ASSIGNED), validate({ query: schemas.nutritionQuery }), nutrition.getDay);
nutritionRoutes.put('/goals', authorize(P.WORKOUT_LOG), validate({ body: schemas.goals }), nutrition.setGoals);
nutritionRoutes.post('/entries', authorize(P.WORKOUT_LOG), validate({ body: schemas.entry }), nutrition.addEntry);
nutritionRoutes.delete('/entries/:id', authorize(P.WORKOUT_LOG), validate({ params: schemas.idParam }), nutrition.deleteEntry);
nutritionRoutes.put('/water', authorize(P.WORKOUT_LOG), validate({ body: schemas.water }), nutrition.setWater);

// Owner reports.
const reportRoutes = Router();
reportRoutes.use(authenticate, authorize(P.REVENUE_READ));
const q = validate({ query: schemas.reportQuery });
reportRoutes.get('/members.csv', q, reports.membersCsv);
reportRoutes.get('/payments.csv', q, reports.paymentsCsv);
reportRoutes.get('/attendance.csv', q, reports.attendanceCsv);
reportRoutes.get('/trainers', q, reports.trainerPerformance);

module.exports = { clientRoutes, resourceRoutes, nutritionRoutes, reportRoutes };
