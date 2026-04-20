const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  type: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    default: 'string'
  },
  category: {
    type: String,
    enum: ['general', 'payment', 'security', 'ui'],
    default: 'general'
  },
  description: String,
  isPublic: {
    type: Boolean,
    default: false
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AppConfig', appConfigSchema);