const mongoose = require('mongoose');

const gameScoreSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  level: {
    type: Number,
    default: 1
  },
  duration: {
    type: Number, // en secondes
    default: 0
  },
  rewardsEarned: {
    pi: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    items: [String]
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index pour les classements
gameScoreSchema.index({ game: 1, score: -1 });
gameScoreSchema.index({ user: 1, game: 1 });
gameScoreSchema.index({ createdAt: -1 });

module.exports = mongoose.model('GameScore', gameScoreSchema);