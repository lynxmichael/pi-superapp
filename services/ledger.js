/**
 * Mouvements de Pi à l'intérieur de l'application (le solde de chaque utilisateur).
 *
 * Toutes les opérations sont atomiques sur le document concerné :
 * - un débit ne passe que si le solde est suffisant, même avec plusieurs clics en même temps ;
 * - des Pi « bloqués » (held) ne peuvent être libérés OU remboursés qu'une seule fois.
 */
const User = require('../models/User');
const PiOperation = require('../models/PiOperation');

const EPS = 1e-9;
const round7 = (n) => Math.round(Number(n) * 1e7) / 1e7;
const fmt = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 7 });

function httpError(status, message) {
  const err = new Error(message);
  err.httpStatus = status;
  return err;
}

/** Montant valide (> 0), arrondi à 7 décimales comme sur la blockchain Pi. */
function parseAmount(raw) {
  if (typeof raw === 'string') raw = raw.replace(',', '.').trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return round7(n);
}

/**
 * Débite le solde et crée la ligne d'historique.
 * status : 'completed' (paiement définitif) ou 'held' (Pi bloqués en attente).
 */
async function debit(userId, amount, { type, label, ref, status = 'completed' }) {
  amount = round7(amount);
  if (!(amount > 0)) throw httpError(400, 'Montant invalide.');

  const user = await User.findOneAndUpdate(
    { _id: userId, status: 'active', balance: { $gte: amount - EPS } },
    { $inc: { balance: -amount, totalSpent: amount } },
    { new: true }
  );
  if (!user) {
    const current = await User.findById(userId).select('balance');
    const have = current ? Math.max(0, round7(current.balance || 0)) : 0;
    throw httpError(400, `Solde insuffisant : il faut ${fmt(amount)} π, vous avez ${fmt(have)} π.`);
  }

  try {
    const op = await PiOperation.create({
      user: user._id,
      piUid: user.piUid,
      piUsername: user.piUsername,
      type,
      label,
      ref,
      amount,
      status,
      completedAt: status === 'completed' ? new Date() : undefined
    });
    return { op, user };
  } catch (error) {
    await User.updateOne({ _id: user._id }, { $inc: { balance: amount, totalSpent: -amount } });
    throw error;
  }
}

/** Crédite le solde (vente, revenu commerçant) et crée la ligne d'historique. */
async function credit(userId, amount, { type, label, ref }) {
  amount = round7(amount);
  if (!(amount > 0)) return null;
  const user = await User.findById(userId).select('piUid piUsername');
  if (!user) throw httpError(404, 'Utilisateur introuvable.');

  const op = await PiOperation.create({
    user: user._id,
    piUid: user.piUid,
    piUsername: user.piUsername,
    type,
    label,
    ref,
    amount,
    status: 'completed',
    completedAt: new Date()
  });
  await User.updateOne({ _id: user._id }, { $inc: { balance: amount, totalEarned: amount } });
  return op;
}

/** Les Pi bloqués deviennent un paiement définitif. Renvoie false si déjà traité. */
async function settleHeld(opId) {
  const op = await PiOperation.findOneAndUpdate(
    { _id: opId, status: 'held' },
    { $set: { status: 'completed', completedAt: new Date() } },
    { new: true }
  );
  return !!op;
}

/** Les Pi bloqués sont rendus à l'utilisateur. Renvoie false si déjà traité. */
async function refundHeld(opId, reason) {
  const op = await PiOperation.findOneAndUpdate(
    { _id: opId, status: 'held' },
    { $set: { status: 'refunded', rejectionReason: reason, completedAt: new Date() } },
    { new: true }
  );
  if (!op) return false;
  await User.updateOne({ _id: op.user }, { $inc: { balance: op.amount, totalSpent: -op.amount } });
  return true;
}

/** Commission prélevée par l'app (en %), arrondie. */
function commission(amount, percent) {
  const p = Number(percent) || 0;
  if (p <= 0) return 0;
  return round7(amount * Math.min(p, 100) / 100);
}

module.exports = { debit, credit, settleHeld, refundHeld, commission, parseAmount, round7, fmt, httpError, EPS };
