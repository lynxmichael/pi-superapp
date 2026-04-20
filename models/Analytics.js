const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  page: String,
  duration: Number,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  device: {
    type: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet']
    },
    browser: String,
    os: String
  },
  location: {
    country: String,
    city: String,
    ip: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index pour les requêtes analytiques
analyticsSchema.index({ type: 1, timestamp: -1 });
analyticsSchema.index({ user: 1, timestamp: -1 });
analyticsSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);