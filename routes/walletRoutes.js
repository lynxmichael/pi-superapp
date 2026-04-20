const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const {
  getBalance,
  getTransactions,
  transferFunds,
  getWalletAddress,
  exportTransactions,
  getEarningStats,
  getWalletStats
} = require('../controllers/walletController');

// Routes portefeuille
router.get('/balance', auth, getBalance);
router.get('/transactions', auth, getTransactions);
router.get('/address', auth, getWalletAddress);
router.get('/export', auth, exportTransactions);
router.get('/stats', auth, getEarningStats);
router.get('/wallet-stats', auth, getWalletStats);
// Transfert
router.post('/transfer', auth, transferFunds);


module.exports = router;