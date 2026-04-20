const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  address: {
    type: String,
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  lockedBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'PI'
  },
  totalReceived: {
    type: Number,
    default: 0
  },
  totalSent: {
    type: Number,
    default: 0
  },
  transactionCount: {
    type: Number,
    default: 0
  },
  security: {
    pinHash: String,
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    lastAccess: Date,
    failedAttempts: {
      type: Number,
      default: 0
    },
    lockedUntil: Date
  },
  settings: {
    autoWithdraw: {
      type: Boolean,
      default: false
    },
    withdrawalLimit: {
      type: Number,
      default: 1000
    },
    notification: {
      type: Boolean,
      default: true
    },
    currencyPreference: {
      type: String,
      default: 'PI'
    }
  },
  stats: {
    firstTransaction: Date,
    lastTransaction: Date,
    dailyVolume: Number,
    weeklyVolume: Number,
    monthlyVolume: Number
  }
}, {
  timestamps: true
});

// Index
walletSchema.index({ address: 1 });
walletSchema.index({ balance: -1 });
walletSchema.index({ 'stats.lastTransaction': -1 });

// Méthode pour obtenir le solde disponible
walletSchema.methods.getAvailableBalance = function() {
  return this.balance - this.lockedBalance;
};

// Méthode pour vérifier si le solde est suffisant
walletSchema.methods.hasSufficientBalance = function(amount) {
  return this.getAvailableBalance() >= amount;
};

// Méthode pour bloquer des fonds
walletSchema.methods.lockFunds = function(amount) {
  if (!this.hasSufficientBalance(amount)) {
    throw new Error('Solde insuffisant');
  }
  this.lockedBalance += amount;
  return this;
};

// Méthode pour débloquer des fonds
walletSchema.methods.unlockFunds = function(amount) {
  if (this.lockedBalance < amount) {
    throw new Error('Montant à débloquer supérieur au solde bloqué');
  }
  this.lockedBalance -= amount;
  return this;
};

// Méthode pour créditer le portefeuille
walletSchema.methods.credit = function(amount) {
  this.balance += amount;
  this.totalReceived += amount;
  this.transactionCount += 1;
  this.stats.lastTransaction = new Date();
  return this;
};

// Méthode pour débiter le portefeuille
walletSchema.methods.debit = function(amount) {
  if (!this.hasSufficientBalance(amount)) {
    throw new Error('Solde insuffisant');
  }
  this.balance -= amount;
  this.totalSent += amount;
  this.transactionCount += 1;
  this.stats.lastTransaction = new Date();
  return this;
};

// Méthode pour vérifier le PIN
walletSchema.methods.verifyPin = async function(pin) {
  const bcrypt = require('bcryptjs');
  if (!this.security.pinHash) return false;
  return await bcrypt.compare(pin, this.security.pinHash);
};

// Hacher le PIN avant sauvegarde
walletSchema.pre('save', async function(next) {
  if (this.isModified('security.pinHash') && this.security.pinHash) {
    const bcrypt = require('bcryptjs');
    this.security.pinHash = await bcrypt.hash(this.security.pinHash, 10);
  }
  
  // Si c'est la première création, initialiser les stats
  if (this.isNew) {
    if (!this.stats) {
      this.stats = {};
    }
    this.stats.firstTransaction = new Date();
  }
  
  next();
});

module.exports = mongoose.model('Wallet', walletSchema);