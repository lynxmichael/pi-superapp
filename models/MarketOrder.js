const mongoose = require('mongoose');

/**
 * Commande marketplace.
 * paid (Pi de l'acheteur bloqués) -> shipped (le vendeur a envoyé) -> completed (réception confirmée : vendeur payé)
 * paid | shipped -> cancelled (Pi rendus à l'acheteur)
 * paid | shipped -> disputed (litige) -> completed (l'admin paie le vendeur) | cancelled (l'admin rembourse)
 */
const marketOrderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyerUsername: String,
  sellerUsername: String,

  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  productImage: String,
  unitPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  total: { type: Number, required: true, min: 0 },

  commissionPercent: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  sellerAmount: Number,

  deliveryNote: { type: String, maxlength: 500 },
  shippingNote: { type: String, maxlength: 300 },

  status: {
    type: String,
    enum: ['paid', 'shipped', 'completed', 'cancelled', 'disputed'],
    default: 'paid',
    index: true
  },
  cancelReason: String,
  cancelledBy: { type: String, enum: ['buyer', 'seller', 'admin'] },
  disputeReason: String,
  resolution: { type: String, enum: ['refund', 'release'] },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  buyerOp: { type: mongoose.Schema.Types.ObjectId, ref: 'PiOperation' },
  saleOp: { type: mongoose.Schema.Types.ObjectId, ref: 'PiOperation' },

  shippedAt: Date,
  disputedAt: Date,
  completedAt: Date,
  cancelledAt: Date
}, {
  timestamps: true,
  collection: 'market_orders'
});

marketOrderSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('MarketOrder', marketOrderSchema);
