const { Router } = require('express');

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/gym', require('./gym.routes'));

module.exports = router;
