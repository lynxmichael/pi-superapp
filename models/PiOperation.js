const mongoose = require('mongoose');

/**
 * Chaque mouvement de Pi sur le solde d'un utilisateur (une ligne de son historique).
 *
 * Entrées (crédit du solde)  : deposit, sale (vente marketplace), income (revenu commerçant)
 * Sorties (débit du solde)   : withdrawal, purchase (achat marketplace), recharge, booking (réservation), subscription
 *
 * Dépôt   : pending (en attente de la blockchain) -> completed | cancelled
 * Retrait : pending (attend l'admin) -> processing -> completed
 *                                     \-> failed (fonds toujours réservés, l'admin peut réessayer ou refuser)
 *                                     \-> rejected (refusé, fonds rendus à l'utilisateur)
 * Achat, recharge, réservation : held (Pi bloqués, en attente) -> completed (payé) | refunded (rendu)
 */
const IN_TYPES = ['deposit', 'sale', 'income'];
const OUT_TYPES = ['withdrawal', 'purchase', 'recharge', 'booking', 'subscription'];

const piOperationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  piUid: { type: String },
  piUsername: String,

  type: { type: String, enum: [...IN_TYPES, ...OUT_TYPES], required: true },

  // Texte affiché dans l'historique (ex. « Achat : Téléphone Tecno »)
  label: { type: String, maxlength: 160 },
  // Objet lié (commande, recharge, réservation...)
  ref: {
    kind: { type: String },
    id: { type: mongoose.Schema.Types.ObjectId }
  },

  // Montant crédité ou débité du solde
  amount: { type: Number, required: true, min: 0 },
  // Frais de retrait et montant réellement envoyé sur le wallet Pi
  fee: { type: Number, default: 0 },
  netAmount: { type: Number },

  status: {
    type: String,
    enum: ['pending', 'processing', 'held', 'completed', 'failed', 'rejected', 'refunded', 'cancelled'],
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

piOperationSchema.statics.IN_TYPES = IN_TYPES;
piOperationSchema.statics.OUT_TYPES = OUT_TYPES;

module.exports = mongoose.model('PiOperation', piOperationSchema);
