const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middlewares/auth');
const m = require('../controllers/marketplaceController');
const { photos } = require('../utils/uploads');
const { verifiedOnly } = require('../utils/http');

// Catalogue
router.get('/products', m.listProducts);
router.get('/products/:id', optionalAuth, m.getProduct);

// Vendeur (identité vérifiée pour publier)
router.get('/my/products', auth, m.myProducts);
router.post('/products', auth, verifiedOnly, photos('images', 4), m.createProduct);
router.put('/products/:id', auth, photos('images', 4), m.updateProduct);
router.delete('/products/:id', auth, m.deleteProduct);

// Achat et commandes
router.post('/products/:id/buy', auth, m.buyProduct);
router.get('/orders', auth, m.listOrders);
router.post('/orders/:id/ship', auth, m.shipOrder);
router.post('/orders/:id/confirm', auth, m.confirmOrder);
router.post('/orders/:id/cancel', auth, m.cancelOrder);
router.post('/orders/:id/dispute', auth, m.disputeOrder);

module.exports = router;
