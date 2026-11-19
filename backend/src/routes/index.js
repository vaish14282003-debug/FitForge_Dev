const { Router } = require('express');
const mongoose = require('mongoose');

const router = Router();

// For uptime monitors and the hosting platform: 503 whenever the database is unreachable.
router.get('/health', (_req, res) => {
  const database = mongoose.connection.readyState === 1 ? 'ok' : 'unavailable';
  res.status(database === 'ok' ? 200 : 503).json({ status: database === 'ok' ? 'ok' : 'degraded', database });
});
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
router.use('/integrations/strava', require('./strava.routes'));

module.exports = router;
