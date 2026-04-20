const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const {
  createOrder,
  getUserOrders,
  getOrder,
  cancelOrder
} = require('../controllers/ecommerceController');

router.post('/orders', auth, createOrder);
router.get('/orders', auth, getUserOrders);
router.get('/orders/:id', auth, getOrder);
router.post('/orders/:id/cancel', auth, cancelOrder);

module.exports = router;
