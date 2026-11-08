const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middlewares/auth');
const g = require('../controllers/gameController');

router.get('/', optionalAuth, g.listGames);
router.post('/:slug/scores', auth, g.submitScore);
router.get('/:slug/leaderboard', g.leaderboard);

module.exports = router;
