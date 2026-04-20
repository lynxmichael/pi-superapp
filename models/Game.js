const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['arcade', 'puzzle', 'strategy', 'casino', 'other']
  },
  type: {
    type: String,
    enum: ['free', 'paid', 'freemium'],
    default: 'free'
  },
  price: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'PI'
  },
  images: [{
    url: String,
    publicId: String,
    isPrimary: { type: Boolean, default: false }
  }],
  rules: String,
  maxPlayers: {
    type: Number,
    default: 1
  },
  minPlayers: {
    type: Number,
    default: 1
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'easy'
  },
  rewards: {
    type: {
      type: String,
      enum: ['Pi', 'points', 'items'],
      default: 'points'
    },
    amount: {
      type: Number,
      default: 0
    },
    conditions: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  developer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stats: {
    plays: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    topScore: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Index pour la recherche
gameSchema.index({ name: 'text', description: 'text' });
gameSchema.index({ category: 1, status: 1 });
gameSchema.index({ developer: 1 });

module.exports = mongoose.model('Game', gameSchema);