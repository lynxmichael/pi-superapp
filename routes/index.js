const express = require('express');
const router = express.Router();

// Import des routes
const userRoutes = require('./userRoutes');
const paymentRoutes = require('./paymentRoutes');
const marketplaceRoutes = require('./marketplaceRoutes');
const ecommerceRoutes = require('./ecommerceRoutes');
const walletRoutes = require('./walletRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const reservationRoutes = require('./reservationRoutes');
const gameRoutes = require('./gameRoutes');
const filesRoutes = require('./filesRoutes');
const rechargeRoutes = require('./rechargeRoutes');

// Routes principales
router.use('/auth', userRoutes);
router.use('/payments', paymentRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/ecommerce', ecommerceRoutes);
router.use('/wallet', walletRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/reservations', reservationRoutes);
router.use('/games', gameRoutes);
router.use('/files', filesRoutes);
router.use('/recharge', rechargeRoutes);

// Route de santé
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Pi SuperApp API'
  });
});

// Route d'information API
router.get('/info', (req, res) => {
  res.json({
    name: 'Pi SuperApp',
    version: '1.0.0',
    description: 'Application multifonction Pi Network',
    endpoints: {
      auth: '/api/auth',
      payments: '/api/payments',
      marketplace: '/api/marketplace',
      wallet: '/api/wallet'
    }
  });
});

module.exports = router;