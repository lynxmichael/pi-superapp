const mongoose = require('mongoose');

/** Abonnement d'un client à l'offre d'un commerçant. Chaque paiement prolonge la date de fin. */
const membershipSchema = new mongoose.Schema({
  offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
  offerTitle: String,
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  merchantUsername: String,
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customerUsername: String,

  period: { type: String, enum: ['week', 'month', 'year'], required: true },
  price: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  payments: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 }
}, {
  timestamps: true,
  collection: 'memberships'
});

membershipSchema.index({ offer: 1, customer: 1 }, { unique: true });

module.exports = mongoose.model('Membership', membershipSchema);
