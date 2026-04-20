const mongoose = require('mongoose');

const currencySchema = new mongoose.Schema({
  base: {
    type: String,
    required: true
  },
  target: {
    type: String,
    required: true
  },
  rate: {
    type: Number,
    required: true
  },
  source: {
    type: String,
    required: true
  },
  lastUpdate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index
currencySchema.index({ base: 1, target: 1 }, { unique: true });
currencySchema.index({ isActive: 1 });

module.exports = mongoose.model('Currency', currencySchema);