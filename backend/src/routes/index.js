const { Router } = require('express');

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/gym', require('./gym.routes'));
router.use('/exercises', require('./exercise.routes'));
router.use('/plans', require('./plan.routes'));
router.use('/sessions', require('./session.routes'));

module.exports = router;
