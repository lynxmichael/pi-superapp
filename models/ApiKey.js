const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const apiKeySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  key: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permissions: [String],
  rateLimit: {
    type: Number,
    default: 1000
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: Date,
  expiresAt: Date
}, {
  timestamps: true
});

// Hacher la clé API avant sauvegarde
apiKeySchema.pre('save', async function(next) {
  if (this.isModified('key')) {
    this.key = await bcrypt.hash(this.key, 10);
  }
  next();
});

// Méthode pour vérifier la clé
apiKeySchema.methods.verifyKey = async function(candidateKey) {
  return await bcrypt.compare(candidateKey, this.key);
};

// Index
apiKeySchema.index({ user: 1 });
apiKeySchema.index({ expiresAt: 1 });

module.exports = mongoose.model('ApiKey', apiKeySchema);