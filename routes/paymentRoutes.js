const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const {
  createPayment,
  approvePayment,
  completePayment,
  getPaymentHistory,
  getPaymentDetails,
  cancelPayment
} = require('../controllers/paymentController');

// Routes de paiement
router.post('/create', auth, createPayment);
router.post('/:paymentId/approve', auth, approvePayment);
router.post('/:paymentId/complete', auth, completePayment);
router.post('/:paymentId/cancel', auth, cancelPayment);

// Historique et détails
router.get('/history', auth, getPaymentHistory);
router.get('/:paymentId', auth, getPaymentDetails);

module.exports = router;
