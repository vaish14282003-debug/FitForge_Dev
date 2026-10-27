const { Router } = require('express');

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/gym', require('./gym.routes'));
router.use('/exercises', require('./exercise.routes'));
router.use('/plans', require('./plan.routes'));
router.use('/sessions', require('./session.routes'));
router.use('/progress', require('./progress.routes'));
router.use('/attendance', require('./attendance.routes'));
const membershipRoutes = require('./membership.routes');
router.use('/membership-plans', membershipRoutes.plans);
router.use('/memberships', membershipRoutes.memberships);
router.use('/files', require('./file.routes'));
router.use('/schedule', require('./schedule.routes'));
const notificationRoutes = require('./notification.routes');
router.use('/notifications', notificationRoutes.notifications);
router.use('/announcements', notificationRoutes.announcements);
const extras = require('./extras.routes');
router.use('/clients', extras.clientRoutes);
router.use('/resources', extras.resourceRoutes);
router.use('/nutrition', extras.nutritionRoutes);
router.use('/reports', extras.reportRoutes);

module.exports = router;
