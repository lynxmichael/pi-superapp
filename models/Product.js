const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'PI'
  },
  category: {
    type: String,
    required: true,
    enum: [
      'electronics',
      'fashion',
      'home',
      'sports',
      'books',
      'digital',
      'services',
      'other'
    ]
  },
  images: [{
    url: String,
    publicId: String,
    isPrimary: { type: Boolean, default: false }
  }],
  stock: {
    type: Number,
    default: 0
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  condition: {
    type: String,
    enum: ['new', 'used', 'refurbished'],
    default: 'new'
  },
  tags: [String],
  attributes: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'sold', 'deleted'],
    default: 'active'
  },
  stats: {
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    sales: { type: Number, default: 0 }
  },
  shipping: {
    required: { type: Boolean, default: false },
    cost: { type: Number, default: 0 },
    locations: [String]
  },
  digitalFile: {
    url: String,
    publicId: String,
    filename: String,
    size: Number
  }
}, {
  timestamps: true
});

// Index pour la recherche
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ 'stats.sales': -1 });

// Méthode pour vérifier la disponibilité
productSchema.methods.isAvailable = function() {
  return this.status === 'active' && (this.stock > 0 || this.digitalFile.url);
};

module.exports = mongoose.model('Product', productSchema);