const express = require('express');
const router = express.Router();

// Middlewares
const { auth, optionalAuth } = require('../middlewares/auth');
const { uploadMultiple } = require('../middlewares/upload');

// Controllers
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

// -------------------------
// CRUD PRODUITS
// -------------------------

// CREATE (Upload Cloudinary / max 5 images)
router.post(
  '/products',
  auth,
  uploadMultiple('images', 5),
  createProduct
);

// UPDATE (Upload supplémentaire / max 5 images)
router.put(
  '/products/:id',
  auth,
  uploadMultiple('images', 5),
  updateProduct
);

// DELETE PRODUIT
router.delete('/products/:id', auth, deleteProduct);

// -------------------------
// LECTURE / LISTE / RECHERCHE
// -------------------------
router.get('/products', optionalAuth, getProducts);
router.get('/products/search', optionalAuth, searchProducts);
router.get('/products/categories', getCategories);
router.get('/products/user', auth, getUserProducts);
router.get('/products/:id', optionalAuth, getProduct);

// -------------------------
// INTERACTIONS
// -------------------------
router.post('/products/:id/like', auth, likeProduct);

module.exports = router;
