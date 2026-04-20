const mongoose = require('mongoose');

const rechargeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['mobile', 'electricity', 'water', 'internet', 'tv', 'other']
  },
  provider: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'PI'
  },
  recipient: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  transactionId: String,
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  operatorResponse: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index
rechargeSchema.index({ user: 1, createdAt: -1 });
rechargeSchema.index({ status: 1 });
rechargeSchema.index({ recipient: 1 });

module.exports = mongoose.model('Recharge', rechargeSchema);