const mongoose = require('mongoose');

/**
 * Un dépôt ou un retrait de Pi.
 *
 * Dépôt   : pending (approuvé, en attente de la blockchain) -> completed | cancelled
 * Retrait : pending (attend l'admin) -> processing -> completed
 *                                     \-> failed (fonds toujours réservés, l'admin peut réessayer ou refuser)
 *                                     \-> rejected (refusé, fonds rendus à l'utilisateur)
 */
const piOperationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  piUid: { type: String, required: true },
  piUsername: String,

  type: { type: String, enum: ['deposit', 'withdrawal'], required: true },

  // Montant crédité (dépôt) ou débité du solde (retrait)
  amount: { type: Number, required: true, min: 0 },
  // Frais de retrait et montant réellement envoyé sur le wallet Pi
  fee: { type: Number, default: 0 },
  netAmount: { type: Number },

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },

  piPaymentId: { type: String, unique: true, sparse: true },
  txid: String,
  network: String,

  errorMessage: String,
  rejectionReason: String,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  completedAt: Date
}, {
  timestamps: true,
  collection: 'pi_operations'
});

piOperationSchema.index({ user: 1, createdAt: -1 });
piOperationSchema.index({ type: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('PiOperation', piOperationSchema);
