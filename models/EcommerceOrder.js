const mongoose = require('mongoose');

const ecommerceOrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    total: {
      type: Number,
      required: true
    }
  }],
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
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  shippingAddress: {
    firstName: String,
    lastName: String,
    address: String,
    city: String,
    postalCode: String,
    country: String,
    phone: String
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  trackingNumber: String,
  notes: String
}, {
  timestamps: true
});

// Index
ecommerceOrderSchema.index({ user: 1, createdAt: -1 });
ecommerceOrderSchema.index({ orderId: 1 });
ecommerceOrderSchema.index({ status: 1 });

module.exports = mongoose.model('EcommerceOrder', ecommerceOrderSchema);