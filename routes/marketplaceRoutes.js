const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middlewares/auth');
const { uploadMultiple } = require('../middlewares/upload');
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getProduct,
  getUserProducts,
  searchProducts,
  likeProduct,
  getCategories
} = require('../controllers/marketplaceController');

// Routes produits
router.post('/products', auth, uploadMultiple('images', 5), createProduct);
router.put('/products/:id', auth, uploadMultiple('images', 5), updateProduct);
router.delete('/products/:id', auth, deleteProduct);

// Recherche et liste
router.get('/products', optionalAuth, getProducts);
router.get('/products/search', optionalAuth, searchProducts);
router.get('/products/categories', getCategories);
router.get('/products/user', auth, getUserProducts);
router.get('/products/:id', optionalAuth, getProduct);

// Interactions
router.post('/products/:id/like', auth, likeProduct);

module.exports = router;