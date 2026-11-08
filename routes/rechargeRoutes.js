const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const r = require('../controllers/rechargeController');

router.post('/', auth, r.createRecharge);
router.get('/', auth, r.listMyRecharges);

module.exports = router;
