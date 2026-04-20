const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['send', 'receive', 'payment', 'refund', 'bonus'],
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
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  fromAddress: {
    type: String,
    required: true
  },
  toAddress: {
    type: String,
    required: true
  },
  memo: {
    type: String,
    trim: true
  },
  fee: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  piPaymentId: {
    type: String
  },
  txid: {
    type: String
  },
  confirmedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index pour les recherches courantes
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ fromAddress: 1 });
transactionSchema.index({ toAddress: 1 });

// Calcul du montant net avant sauvegarde
transactionSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('fee')) {
    this.netAmount = this.amount - this.fee;
  }
  next();
});

// Méthode pour vérifier si la transaction est expirée
transactionSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Méthode pour vérifier si la transaction est complétée
transactionSchema.methods.isCompleted = function() {
  return this.status === 'completed';
};

// Méthode pour générer un ID de transaction
transactionSchema.statics.generateTransactionId = function() {
  return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
};

module.exports = mongoose.model('Transaction', transactionSchema);