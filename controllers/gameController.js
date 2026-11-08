/**
 * Jeux pour s'amuser : scores et classement, AUCUN gain en Pi
 * (le score vient du navigateur et ne peut donc pas servir à payer quoi que ce soit).
 */
const GameScore = require('../models/GameScore');
const { handle, httpError } = require('../utils/http');

const GAMES = {
  calcul: {
    name: 'Calcul éclair',
    description: 'Un maximum de bonnes réponses en 60 secondes.',
    maxScore: 1000
  },
  memoire: {
    name: 'Mémoire',
    description: 'Retrouvez les 8 paires avec le moins de coups possible.',
    maxScore: 1000
  }
};

const MIN_SECONDS_BETWEEN_SCORES = 5;

function gameOr404(slug) {
  const game = GAMES[slug];
  if (!game) throw httpError(404, 'Jeu introuvable.');
  return game;
}

async function bestScores(slug, limit) {
  return GameScore.aggregate([
    { $match: { game: slug } },
    { $sort: { score: -1, createdAt: 1 } },
    { $group: { _id: '$user', piUsername: { $first: '$piUsername' }, score: { $first: '$score' } } },
    { $sort: { score: -1 } },
    { $limit: limit }
  ]);
}

const listGames = handle(async (req, res) => {
  const games = await Promise.all(Object.entries(GAMES).map(async ([slug, g]) => {
    let best = null;
    if (req.user) {
      const top = await GameScore.findOne({ game: slug, user: req.user._id }).sort({ score: -1 });
      best = top ? top.score : null;
    }
    const [leader] = await bestScores(slug, 1);
    return {
      slug, name: g.name, description: g.description, myBest: best,
      leader: leader ? { piUsername: leader.piUsername, score: leader.score } : null
    };
  }));
  res.json({ games });
});

const submitScore = handle(async (req, res) => {
  const slug = req.params.slug;
  const game = gameOr404(slug);
  const score = Number(req.body && req.body.score);
  if (!Number.isInteger(score) || score < 0 || score > game.maxScore) throw httpError(400, 'Score invalide.');

  const last = await GameScore.findOne({ game: slug, user: req.user._id }).sort({ createdAt: -1 });
  if (last && Date.now() - last.createdAt.getTime() < MIN_SECONDS_BETWEEN_SCORES * 1000) {
    throw httpError(429, 'Doucement : attendez quelques secondes entre deux parties.');
  }

  const previous = await GameScore.findOne({ game: slug, user: req.user._id }).sort({ score: -1 });
  await GameScore.create({ user: req.user._id, piUsername: req.user.piUsername, game: slug, score });
  const newRecord = !previous || score > previous.score;
  res.status(201).json({ score, myBest: newRecord ? score : previous.score, newRecord });
});

const leaderboard = handle(async (req, res) => {
  const slug = req.params.slug;
  const game = gameOr404(slug);
  const top = await bestScores(slug, 20);
  res.json({
    game: { slug, name: game.name },
    leaderboard: top.map((row, i) => ({ rank: i + 1, piUsername: row.piUsername, score: row.score }))
  });
});

module.exports = { GAMES, listGames, submitScore, leaderboard };
