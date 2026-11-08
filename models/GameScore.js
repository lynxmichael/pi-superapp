const mongoose = require('mongoose');

/** Score d'une partie. Les jeux ne rapportent PAS de Pi : seulement des points et un classement. */
const gameScoreSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  piUsername: String,
  game: { type: String, required: true },
  score: { type: Number, required: true, min: 0 }
}, {
  timestamps: true,
  collection: 'game_scores_v2'
});

gameScoreSchema.index({ game: 1, score: -1 });
gameScoreSchema.index({ user: 1, game: 1, createdAt: -1 });

module.exports = mongoose.model('GameScore', gameScoreSchema);
