const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middlewares/auth');
const {
  getGames,
  getGame,
  submitScore,
  getLeaderboard,
  getUserGameHistory
} = require('../controllers/gameController');

router.get('/games', optionalAuth, getGames);
router.get('/games/:id', optionalAuth, getGame);
router.post('/games/scores', auth, submitScore);
router.get('/games/:gameId/leaderboard', optionalAuth, getLeaderboard);
router.get('/user/games/history', auth, getUserGameHistory);

module.exports = router;