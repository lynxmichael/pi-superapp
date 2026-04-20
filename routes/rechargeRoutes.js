const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const {
  createRecharge,
  getRechargeHistory,
  getRecharge,
  getProviders
} = require('../controllers/rechargeController');

router.post('/recharges', auth, createRecharge);
router.get('/recharges', auth, getRechargeHistory);
router.get('/recharges/:id', auth, getRecharge);
router.get('/providers', auth, getProviders);

module.exports = router;