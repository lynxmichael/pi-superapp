const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'PI'
  },
  billingCycle: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: true
  },
  features: [{
    name: String,
    included: { type: Boolean, default: true }
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  maxUsage: {
    type: Number
  },
  trialPeriod: {
    type: Number, // en jours
    default: 0
  }
}, {
  timestamps: true
});

const userSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  nextBillingDate: {
    type: Date
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  paymentHistory: [{
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    amount: Number,
    date: Date,
    status: String
  }]
}, {
  timestamps: true
});

// Index
userSubscriptionSchema.index({ user: 1, status: 1 });
userSubscriptionSchema.index({ endDate: 1 });

// Méthode pour vérifier si l'abonnement est actif
userSubscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && this.endDate > new Date();
};

module.exports = {
  Subscription: mongoose.model('Subscription', subscriptionSchema),
  UserSubscription: mongoose.model('UserSubscription', userSubscriptionSchema)
};