const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const {
  createTransaction,
  getTransactionHistory,
  getTransaction,
  cancelTransaction,
  checkTransactionStatus,
  exportTransactions
} = require('../controllers/transactionController');

// Créer une transaction
router.post('/', auth, createTransaction);

// Obtenir l'historique des transactions
router.get('/', auth, getTransactionHistory);

// Obtenir une transaction spécifique
router.get('/:id', auth, getTransaction);

// Annuler une transaction
router.post('/:id/cancel', auth, cancelTransaction);

// Vérifier le statut d'une transaction
router.get('/:id/status', auth, checkTransactionStatus);

// Exporter les transactions
router.get('/export/transactions', auth, exportTransactions);

module.exports = router;