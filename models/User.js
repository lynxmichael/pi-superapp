const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  piUsername: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  piUid: {
    type: String,
    required: true,
    unique: true
  },
  walletAddress: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  balance: {
    type: Number,
    default: 0
  },
  totalEarned: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    bio: String,
    location: String
  },
  preferences: {
    notifications: { type: Boolean, default: true },
    language: { type: String, default: 'fr' },
    currency: { type: String, default: 'PI' }
  },
  verification: {
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    kycStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' }
  },
  security: {
    loginPin: String,
    twoFactorEnabled: { type: Boolean, default: false }
  },
  stats: {
    totalTransactions: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
    lastLogin: Date,
    loginCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Index pour les recherches courantes
userSchema.index({ piUsername: 1 });
userSchema.index({ walletAddress: 1 });
userSchema.index({ 'stats.joinedAt': -1 });

// Méthode pour vérifier le PIN
userSchema.methods.verifyPin = async function(pin) {
  return await bcrypt.compare(pin, this.security.loginPin);
};

// Méthode pour générer le token JWT
userSchema.methods.generateAuthToken = function() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { userId: this._id, piUid: this.piUid },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Middleware pour hacher le PIN avant sauvegarde
userSchema.pre('save', async function(next) {
  if (this.isModified('security.loginPin')) {
    this.security.loginPin = await bcrypt.hash(this.security.loginPin, 10);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);