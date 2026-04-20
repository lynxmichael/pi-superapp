const Game = require('../models/Game');
const GameScore = require('../models/GameScore');

// Obtenir tous les jeux
const getGames = async (req, res) => {
  try {
    const { page = 1, limit = 12, category, type } = req.query;
    
    const filter = { status: 'active' };
    if (category) filter.category = category;
    if (type) filter.type = type;

    const games = await Game.find(filter)
      .populate('developer', 'piUsername profile.avatar')
      .sort({ 'stats.plays': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Game.countDocuments(filter);

    res.json({
      games,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur récupération jeux:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des jeux' });
  }
};

// Obtenir un jeu spécifique
const getGame = async (req, res) => {
  try {
    const { id } = req.params;

    const game = await Game.findById(id)
      .populate('developer', 'piUsername profile.avatar');

    if (!game) {
      return res.status(404).json({ error: 'Jeu non trouvé' });
    }

    // Incrémenter le compteur de vues
    game.stats.plays += 1;
    await game.save();

    res.json({ game });
  } catch (error) {
    console.error('Erreur récupération jeu:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du jeu' });
  }
};

// Soumettre un score
const submitScore = async (req, res) => {
  try {
    const { gameId, score, level, duration, rewardsEarned, metadata } = req.body;
    const userId = req.user._id;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Jeu non trouvé' });
    }

    const gameScore = new GameScore({
      user: userId,
      game: gameId,
      score,
      level,
      duration,
      rewardsEarned,
      metadata
    });

    await gameScore.save();

    // Mettre à jour les statistiques du jeu
    if (score > game.stats.topScore) {
      game.stats.topScore = score;
    }

    // Calculer le score moyen
    const scores = await GameScore.find({ game: gameId });
    const averageScore = scores.reduce((acc, curr) => acc + curr.score, 0) / scores.length;
    game.stats.averageScore = averageScore;

    await game.save();

    // Mettre à jour le solde de l'utilisateur si des Pi sont gagnés
    if (rewardsEarned && rewardsEarned.pi > 0) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(userId, {
        $inc: {
          balance: rewardsEarned.pi,
          totalEarned: rewardsEarned.pi
        }
      });
    }

    res.status(201).json({
      message: 'Score enregistré avec succès',
      score: gameScore,
      rewards: rewardsEarned
    });
  } catch (error) {
    console.error('Erreur enregistrement score:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du score' });
  }
};

// Obtenir les classements d'un jeu
const getLeaderboard = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { limit = 10 } = req.query;

    const leaderboard = await GameScore.find({ game: gameId })
      .populate('user', 'piUsername profile.avatar')
      .sort({ score: -1 })
      .limit(parseInt(limit));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Erreur récupération classement:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du classement' });
  }
};

// Obtenir l'historique des parties d'un utilisateur
const getUserGameHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const gameHistory = await GameScore.find({ user: req.user._id })
      .populate('game', 'name images')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await GameScore.countDocuments({ user: req.user._id });

    res.json({
      gameHistory,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur récupération historique jeux:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
};

module.exports = {
  getGames,
  getGame,
  submitScore,
  getLeaderboard,
  getUserGameHistory
};