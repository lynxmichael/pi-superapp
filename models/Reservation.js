const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceType: {
    type: String,
    required: true,
    enum: ['hotel', 'restaurant', 'transport', 'event', 'other']
  },
  serviceName: {
    type: String,
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // en heures
    default: 1
  },
  participants: {
    type: Number,
    default: 1
  },
  totalAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'PI'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  details: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  specialRequests: String,
  cancellationReason: String
}, {
  timestamps: true
});

// Index pour les recherches
reservationSchema.index({ user: 1, date: 1 });
reservationSchema.index({ provider: 1, date: 1 });
reservationSchema.index({ serviceType: 1, status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);