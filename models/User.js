const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  piUsername: {
    type: String,
    required: [true, 'Le nom d\'utilisateur Pi est requis'],
    unique: true,
    trim: true,
    minlength: [3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères'],
    maxlength: [50, 'Le nom d\'utilisateur ne peut pas dépasser 50 caractères']
  },
  piUid: {
    type: String,
    required: [true, 'L\'UID Pi est requis'],
    unique: true
  },
  // Optionnel : la connexion Pi ne fournit pas toujours l'adresse du wallet
  walletAddress: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  // Optionnel : la connexion Pi ne demande pas d'email
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(v);
      },
      message: 'Email invalide'
    }
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^\+?[0-9]{8,15}$/.test(v.replace(/\s/g, ''));
      },
      message: 'Numéro de téléphone invalide'
    }
  },
  // Solde en Pi réellement déposés : toujours 0 à la création
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Le solde ne peut pas être négatif']
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
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    bio: {
      type: String,
      maxlength: [500, 'La bio ne peut pas dépasser 500 caractères']
    },
    avatar: {
      type: String,
      default: function() {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.piUsername)}&background=7c3aed&color=fff&size=150`;
      }
    },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say']
    },
    country: String,
    city: String,
    address: String
  },
  // ========================================================================
  // VÉRIFICATION & KYC COMPLET
  // ========================================================================
  verification: {
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerifiedAt: Date,
    phoneVerified: {
      type: Boolean,
      default: false
    },
    phoneVerifiedAt: Date,

    // ---- KYC ----
    kycStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    },
    kycSubmittedAt: Date,
    kycApprovedAt: Date,
    kycRejectedAt: Date,
    kycReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    kycRejectionReason: String,
    kycAdminNotes: String,

    // Identité déclarée lors du KYC
    kycIdentity: {
      firstName: String,
      lastName: String,
      dateOfBirth: Date,
      nationality: String,
      address: String,
      phone: String
    },

    // Documents d'identité
    kycDocuments: {
      type: {
        type: String,
        enum: ['passport', 'id_card', 'driver_license']
      },
      number: String,
      frontImage: String,
      backImage: String
    },

    // Selfie de vérification faciale
    kycSelfie: {
      image: String,
      capturedAt: Date
    },

    // SMS de validation
    kycSmsValidation: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      message: String
    }
  },
  preferences: {
    language: {
      type: String,
      enum: ['fr', 'en'],
      default: 'fr'
    },
    currency: {
      type: String,
      enum: ['PI', 'USD', 'EUR', 'XOF'],
      default: 'PI'
    },
    notifications: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: false
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    }
  },
  security: {
    loginPin: String,
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: String,
    lastPasswordChange: Date,
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date
  },
  stats: {
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastLogin: Date,
    loginCount: {
      type: Number,
      default: 0
    },
    totalTransactions: {
      type: Number,
      default: 0
    },
    totalProducts: {
      type: Number,
      default: 0
    },
    totalRecharges: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned', 'pending'],
    default: 'active'
  },
  role: {
    type: String,
    enum: ['user', 'merchant', 'admin'],
    default: 'user'
  }
}, {
  timestamps: true,
  collection: 'users',
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.security;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
});

// Index
// piUsername, piUid, walletAddress et email sont déjà indexés (unique)
userSchema.index({ 'stats.joinedAt': -1 });
userSchema.index({ status: 1 });
userSchema.index({ 'verification.kycStatus': 1 });

// Virtual nom complet
userSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.piUsername;
});

// Vérifier le PIN
userSchema.methods.verifyPin = async function(pin) {
  if (!this.security.loginPin) return false;
  return await bcrypt.compare(pin, this.security.loginPin);
};

// Générer token JWT
userSchema.methods.generateAuthToken = function() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { 
      userId: this._id, 
      piUid: this.piUid,
      walletAddress: this.walletAddress,
      role: this.role
    },
    process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
};

// Hash PIN avant sauvegarde
userSchema.pre('save', async function(next) {
  if (this.isModified('security.loginPin') && this.security.loginPin) {
    this.security.loginPin = await bcrypt.hash(this.security.loginPin, 12);
  }
  next();
});

// Méthodes statiques
userSchema.statics.findByWalletAddress = function(walletAddress) {
  return this.findOne({ walletAddress });
};

userSchema.statics.findByUsername = function(piUsername) {
  return this.findOne({ piUsername });
};

// Incrémenter solde
userSchema.methods.incrementBalance = async function(amount) {
  this.balance += amount;
  this.totalEarned += amount;
  return await this.save();
};

// Décrémenter solde
userSchema.methods.decrementBalance = async function(amount) {
  if (this.balance < amount) {
    throw new Error('Solde insuffisant');
  }
  this.balance -= amount;
  this.totalSpent += amount;
  return await this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;