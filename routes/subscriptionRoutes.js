const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const {
  getSubscriptions,
  subscribe,
  getUserSubscriptions,
  cancelSubscription
} = require('../controllers/subscriptionController');

router.get('/subscriptions', auth, getSubscriptions);
router.post('/subscriptions', auth, subscribe);
router.get('/user/subscriptions', auth, getUserSubscriptions);
router.post('/subscriptions/:id/cancel', auth, cancelSubscription);

module.exports = router;