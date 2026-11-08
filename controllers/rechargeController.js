/**
 * Recharges et factures payées en Pi, faites À LA MAIN par l'admin.
 * Le prix en Pi est calculé avec le taux fixé par l'admin (monnaie locale pour 1 π).
 */
const mongoose = require('mongoose');
const Recharge = require('../models/Recharge');
const AppSetting = require('../models/AppSetting');
const ledger = require('../services/ledger');
const { handle, httpError, cleanText } = require('../utils/http');

const KINDS = {
  mobile: 'Crédit mobile',
  internet: 'Forfait internet',
  electricity: 'Électricité',
  water: 'Eau',
  tv: 'Abonnement TV'
};

function piPrice(localAmount, settings) {
  return ledger.round7((localAmount / settings.rechargeRate) * (1 + (settings.rechargeFeePercent || 0) / 100));
}

function publicRecharge(r) {
  return {
    id: r._id,
    piUsername: r.piUsername,
    kind: r.kind,
    kindLabel: KINDS[r.kind],
    operator: r.operator,
    recipient: r.recipient,
    localAmount: r.localAmount,
    currency: r.currency,
    piAmount: r.piAmount,
    status: r.status,
    reference: r.reference,
    refuseReason: r.refuseReason,
    createdAt: r.createdAt,
    handledAt: r.handledAt
  };
}

const createRecharge = handle(async (req, res) => {
  const settings = await AppSetting.current();
  if (!(settings.rechargeRate > 0)) throw httpError(400, 'Les recharges ne sont pas encore ouvertes.');

  const body = req.body || {};
  const kind = body.kind;
  if (!KINDS[kind]) throw httpError(400, 'Choisissez le type de recharge.');

  const operator = cleanText(body.operator, 60);
  if (operator.length < 2) throw httpError(400, 'Indiquez l\'opérateur ou la compagnie.');

  const recipient = cleanText(body.recipient, 40);
  if (!/^[0-9A-Za-z+\- ]{4,40}$/.test(recipient)) {
    throw httpError(400, kind === 'mobile' || kind === 'internet'
      ? 'Entrez un numéro de téléphone valide.'
      : 'Entrez un numéro de compteur ou de contrat valide.');
  }

  const localAmount = Number(String(body.localAmount || '').replace(/\s/g, ''));
  if (!Number.isInteger(localAmount) || localAmount < settings.rechargeMin || localAmount > settings.rechargeMax) {
    throw httpError(400, `Le montant doit être entre ${settings.rechargeMin.toLocaleString('fr-FR')} et ${settings.rechargeMax.toLocaleString('fr-FR')} ${settings.rechargeCurrency}.`);
  }

  const piAmount = piPrice(localAmount, settings);
  const id = new mongoose.Types.ObjectId();
  const label = `${KINDS[kind]} ${operator} : ${localAmount.toLocaleString('fr-FR')} ${settings.rechargeCurrency}`;

  const { op } = await ledger.debit(req.user._id, piAmount, {
    type: 'recharge',
    status: 'held',
    label,
    ref: { kind: 'recharge', id }
  });

  try {
    const recharge = await Recharge.create({
      _id: id,
      user: req.user._id,
      piUsername: req.user.piUsername,
      kind,
      operator,
      recipient,
      localAmount,
      currency: settings.rechargeCurrency,
      rate: settings.rechargeRate,
      feePercent: settings.rechargeFeePercent || 0,
      piAmount,
      op: op._id
    });
    res.status(201).json({ recharge: publicRecharge(recharge) });
  } catch (error) {
    await ledger.refundHeld(op._id, 'Recharge annulée (erreur)');
    throw error;
  }
});

const listMyRecharges = handle(async (req, res) => {
  const recharges = await Recharge.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ recharges: recharges.map(publicRecharge) });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const adminListRecharges = handle(async (req, res) => {
  const filter = req.query.status === 'all' ? {} : { status: 'pending' };
  const recharges = await Recharge.find(filter).sort({ createdAt: req.query.status === 'all' ? -1 : 1 }).limit(200);
  res.json({ recharges: recharges.map(publicRecharge) });
});

const adminCompleteRecharge = handle(async (req, res) => {
  const recharge = await Recharge.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    {
      $set: {
        status: 'completed',
        reference: cleanText(req.body && req.body.reference, 120),
        handledBy: req.user._id,
        handledAt: new Date()
      }
    },
    { new: true }
  );
  if (!recharge) throw httpError(409, 'Cette recharge a déjà été traitée.');
  await ledger.settleHeld(recharge.op);
  res.json({ recharge: publicRecharge(recharge) });
});

const adminRefuseRecharge = handle(async (req, res) => {
  const reason = cleanText(req.body && req.body.reason, 300) || 'Recharge impossible';
  const recharge = await Recharge.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { $set: { status: 'refused', refuseReason: reason, handledBy: req.user._id, handledAt: new Date() } },
    { new: true }
  );
  if (!recharge) throw httpError(409, 'Cette recharge a déjà été traitée.');
  await ledger.refundHeld(recharge.op, reason);
  res.json({ recharge: publicRecharge(recharge) });
});

module.exports = {
  KINDS,
  createRecharge,
  listMyRecharges,
  adminListRecharges,
  adminCompleteRecharge,
  adminRefuseRecharge
};
