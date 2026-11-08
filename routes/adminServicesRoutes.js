/**
 * Admin des services : réglages, recharges à faire, litiges marketplace, documents KYC privés.
 * Toutes les routes exigent un compte admin.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middlewares/auth');
const isAdmin = require('../middlewares/isAdmin');
const { handle, httpError, cleanText } = require('../utils/http');
const AppSetting = require('../models/AppSetting');
const PiOperation = require('../models/PiOperation');
const Recharge = require('../models/Recharge');
const MarketOrder = require('../models/MarketOrder');
const User = require('../models/User');
const recharge = require('../controllers/rechargeController');
const market = require('../controllers/marketplaceController');

const router = express.Router();
router.use(auth, isAdmin);

const KYC_DIR = path.join(__dirname, '..', 'uploads', 'kyc');

// Nombre de tâches en attente (pastilles de la page admin)
router.get('/tasks', handle(async (req, res) => {
  const [withdrawals, recharges, disputes, kyc] = await Promise.all([
    PiOperation.countDocuments({ type: 'withdrawal', status: { $in: ['pending', 'failed'] } }),
    Recharge.countDocuments({ status: 'pending' }),
    MarketOrder.countDocuments({ status: 'disputed' }),
    User.countDocuments({ 'verification.kycStatus': 'pending' })
  ]);
  res.json({ withdrawals, recharges, disputes, kyc });
}));

// Réglages
router.get('/settings', handle(async (req, res) => {
  res.json({ settings: await AppSetting.current() });
}));

router.put('/settings', handle(async (req, res) => {
  const body = req.body || {};
  const update = {};
  const number = (key, min, max) => {
    if (body[key] === undefined) return;
    if (body[key] === '' || body[key] === null) {
      if (key !== 'rechargeRate') throw httpError(400, 'Valeur manquante.');
      update[key] = null;
      return;
    }
    const n = Number(String(body[key]).replace(',', '.'));
    if (!Number.isFinite(n) || n < min || n > max) throw httpError(400, `Valeur invalide pour ${key}.`);
    update[key] = n;
  };
  number('rechargeRate', 0.000001, 1e9);
  number('rechargeFeePercent', 0, 50);
  number('rechargeMin', 0, 1e9);
  number('rechargeMax', 0, 1e9);
  number('marketCommissionPercent', 0, 50);
  number('offersCommissionPercent', 0, 50);
  if (body.rechargeCurrency !== undefined) {
    update.rechargeCurrency = cleanText(body.rechargeCurrency, 10) || 'FCFA';
  }
  const min = update.rechargeMin !== undefined ? update.rechargeMin : (await AppSetting.current()).rechargeMin;
  const max = update.rechargeMax !== undefined ? update.rechargeMax : (await AppSetting.current()).rechargeMax;
  if (min > max) throw httpError(400, 'Le minimum de recharge dépasse le maximum.');

  const settings = await AppSetting.findByIdAndUpdate('main', { $set: update }, { new: true, upsert: true, setDefaultsOnInsert: true });
  res.json({ settings });
}));

// Recharges à faire
router.get('/recharges', recharge.adminListRecharges);
router.post('/recharges/:id/done', recharge.adminCompleteRecharge);
router.post('/recharges/:id/refuse', recharge.adminRefuseRecharge);

// Litiges marketplace
router.get('/disputes', market.adminListDisputes);
router.post('/disputes/:id/resolve', market.adminResolveDispute);

// Documents KYC (privés)
router.get('/kyc-file/:name', (req, res) => {
  const name = path.basename(req.params.name || '');
  const full = path.join(KYC_DIR, name);
  if (!name.startsWith('kyc-') || !fs.existsSync(full)) return res.status(404).json({ error: 'Document introuvable.' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(full);
});

module.exports = router;
