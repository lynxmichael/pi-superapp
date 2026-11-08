const mongoose = require('mongoose');

/**
 * Recharge (crédit mobile, internet, électricité, eau, TV) payée en Pi.
 * pending (Pi bloqués, l'admin doit faire la recharge) -> completed (faite) | refused (Pi rendus)
 */
const rechargeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  piUsername: String,

  kind: { type: String, enum: ['mobile', 'internet', 'electricity', 'water', 'tv'], required: true },
  operator: { type: String, required: true, maxlength: 60 },
  recipient: { type: String, required: true, maxlength: 40 },

  localAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'FCFA' },
  rate: { type: Number, required: true },
  feePercent: { type: Number, default: 0 },
  piAmount: { type: Number, required: true, min: 0 },

  status: { type: String, enum: ['pending', 'completed', 'refused'], default: 'pending', index: true },
  op: { type: mongoose.Schema.Types.ObjectId, ref: 'PiOperation' },

  reference: { type: String, maxlength: 120 },
  refuseReason: { type: String, maxlength: 300 },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  handledAt: Date
}, {
  timestamps: true,
  collection: 'recharges_pi'
});

module.exports = mongoose.model('Recharge', rechargeSchema);
