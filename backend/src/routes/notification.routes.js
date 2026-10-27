const { Router } = require('express');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { PERMISSIONS: P } = require('../config/roles');
const schemas = require('../validators/notification.validator');
const controller = require('../controllers/notification.controller');

const notifications = Router();
notifications.use(authenticate);
notifications.get('/', validate({ query: schemas.listQuery }), controller.listNotifications);
notifications.get('/unread-count', validate({ query: schemas.listQuery }), controller.unreadCount);
notifications.post('/read-all', controller.markAllRead);
notifications.post('/messages', authorize(P.CLIENTS_READ_ASSIGNED), validate({ body: schemas.message }), controller.sendMessage);
notifications.post('/:id/read', validate({ params: schemas.idParam }), controller.markRead);

const announcements = Router();
announcements.use(authenticate);
announcements.get('/', controller.listAnnouncements);
announcements.post('/', authorize(P.GYM_SETTINGS), validate({ body: schemas.createAnnouncement }), controller.createAnnouncement);
announcements.delete('/:id', authorize(P.GYM_SETTINGS), validate({ params: schemas.idParam }), controller.deleteAnnouncement);

module.exports = { notifications, announcements };
