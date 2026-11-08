const mongoose = require('mongoose');

const PRODUCT_CATEGORIES = [
  'electronics',
  'fashion',
  'home',
  'sports',
  'books',
  'digital',
  'services',
  'other'
];

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },

    description: {
      type: String,
      required: true,
      minlength: 5
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
      enum: PRODUCT_CATEGORIES
    },

    images: [
      {
        url: String,
        publicId: String,
        isPrimary: { type: Boolean, default: false }
      }
    ],

    stock: {
      type: Number,
      default: 0,
      min: 0
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
    // Ville où se trouve le produit (livraison ou retrait)
    city: {
      type: String,
      trim: true,
      maxlength: 80
    },

    tags: {
      type: [String],
      validate: v => Array.isArray(v) && v.length <= 20
    },

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
      cost: { type: Number, default: 0, min: 0 },
      locations: [String]
    },

    digitalFile: {
      url: String,
      publicId: String,
      filename: String,
      size: Number,
      fileType: String, // amélioration
      hash: String      // facultatif mais utile
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ---------- INDEX ----------
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ 'stats.sales': -1 });

// ---------- VIRTUAL : IMAGE PRINCIPALE ----------
productSchema.virtual('primaryImage').get(function () {
  return this.images.find(img => img.isPrimary) || this.images[0] || null;
});

// ---------- METHODES ----------
productSchema.methods.isAvailable = function () {
  return (
    this.status === 'active' && (this.stock > 0 || this.digitalFile?.url)
  );
};

// Assurer qu'une seule image est primaire
productSchema.pre('save', function (next) {
  const primaryImages = this.images.filter(img => img.isPrimary);
  if (primaryImages.length > 1) {
    // On force seulement la première
    this.images.forEach((img, index) => {
      img.isPrimary = index === 0;
    });
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
