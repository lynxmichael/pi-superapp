const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  fromAddress: {
    type: String,
    required: true
  },
  toAddress: {
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
  memo: {
    type: String,
    required: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'completed', 'cancelled', 'failed'],
    default: 'pending'
  },
  txid: {
    type: String
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceType: {
    type: String,
    enum: [
      'marketplace',
      'ecommerce', 
      'recharge',
      'subscription',
      'game',
      'reservation',
      'transfer',
      'other'
    ],
    required: true
  },
  serviceItem: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'serviceType'
  },
  fee: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number
  },
  piNetworkData: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index pour les recherches courantes
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ serviceType: 1 });
paymentSchema.index({ paymentId: 1 });

// Calcul du montant net avant sauvegarde
paymentSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('fee')) {
    this.netAmount = this.amount - this.fee;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);