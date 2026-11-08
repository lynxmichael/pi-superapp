const mongoose = require('mongoose');

/**
 * Réservation d'une offre.
 * pending (Pi du client bloqués) -> confirmed (acceptée : commerçant payé)
 *                                 -> refused (par le commerçant) | cancelled (par le client) : Pi rendus
 */
const bookingSchema = new mongoose.Schema({
  offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
  offerTitle: String,
  unit: String,
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  merchantUsername: String,
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customerUsername: String,

  date: { type: Date, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true },
  note: { type: String, maxlength: 500 },

  commissionPercent: { type: Number, default: 0 },
  commission: Number,
  merchantAmount: Number,

  status: { type: String, enum: ['pending', 'confirmed', 'refused', 'cancelled'], default: 'pending', index: true },
  refuseReason: { type: String, maxlength: 300 },
  op: { type: mongoose.Schema.Types.ObjectId, ref: 'PiOperation' },
  incomeOp: { type: mongoose.Schema.Types.ObjectId, ref: 'PiOperation' },
  decidedAt: Date
}, {
  timestamps: true,
  collection: 'bookings'
});

module.exports = mongoose.model('Booking', bookingSchema);
