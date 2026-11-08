const mongoose = require('mongoose');

/** Offre d'un commerçant vérifié : à réserver (hôtel, restaurant, transport...) ou abonnement. */
const offerSchema = new mongoose.Schema({
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  merchantUsername: String,

  kind: { type: String, enum: ['booking', 'subscription'], required: true },
  category: {
    type: String,
    enum: ['hotel', 'restaurant', 'transport', 'event', 'sport', 'beauty', 'education', 'other'],
    default: 'other'
  },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 2000 },
  city: { type: String, trim: true, maxlength: 80 },
  image: String,

  price: { type: Number, required: true, min: 0 },
  // Réservation : prix « par personne », « par nuit »...
  unit: { type: String, maxlength: 30 },
  // Abonnement : durée payée
  period: { type: String, enum: ['week', 'month', 'year'] },

  status: { type: String, enum: ['active', 'inactive', 'deleted'], default: 'active', index: true },
  stats: {
    bookings: { type: Number, default: 0 },
    subscriptions: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  collection: 'offers'
});

offerSchema.index({ kind: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Offer', offerSchema);
