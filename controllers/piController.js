/**
 * Dépôts et retraits de Pi.
 *
 * Règles de sécurité :
 * - le montant crédité vient toujours du serveur Pi, jamais du navigateur ;
 * - chaque dépôt n'est crédité qu'une seule fois (passage atomique à "completed") ;
 * - un retrait réserve les fonds immédiatement (débit atomique), puis attend
 *   la validation d'un admin ; s'il est refusé, les fonds sont rendus.
 */
const User = require('../models/User');
const PiOperation = require('../models/PiOperation');
const pi = require('../services/piPlatform');

const EPS = 1e-9;
const STUCK_AFTER_MS = 5 * 60 * 1000;

const round7 = (n) => Math.round(Number(n) * 1e7) / 1e7;
const fmt = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 7 });

function envNumber(name, fallback) {
  const v = parseFloat(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

function settings() {
  return {
    sandbox: String(process.env.PI_SANDBOX || '').toLowerCase() === 'true',
    minDeposit: envNumber('MIN_DEPOSIT', 0.01),
    minWithdrawal: envNumber('MIN_WITHDRAWAL', 1),
    withdrawalFee: envNumber('WITHDRAWAL_FEE', 0)
  };
}

function httpError(status, message) {
  const err = new Error(message);
  err.httpStatus = status;
  return err;
}

/** Enveloppe les handlers async : renvoie toujours une erreur JSON lisible. */
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error.name === 'CastError') error = httpError(404, 'Élément introuvable.');
    const status = error.httpStatus || (error.status ? 502 : 500);
    if (status >= 500) console.error('❌ [pi]', error.message);
    res.status(status).json({
      error: status === 500 ? 'Erreur interne, réessayez dans un instant.' : error.message
    });
  }
};

function parseAmount(raw) {
  if (typeof raw === 'string') raw = raw.replace(',', '.').trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return round7(n);
}

function publicUser(user) {
  return {
    id: user._id,
    piUsername: user.piUsername,
    balance: Math.max(0, round7(user.balance || 0)),
    role: user.role
  };
}

function publicOperation(op) {
  return {
    id: op._id,
    type: op.type,
    amount: op.amount,
    fee: op.fee || 0,
    netAmount: op.netAmount,
    status: op.status,
    txid: op.txid,
    rejectionReason: op.rejectionReason,
    createdAt: op.createdAt,
    completedAt: op.completedAt
  };
}

function adminOperation(op) {
  return {
    ...publicOperation(op),
    piUsername: op.piUsername,
    piPaymentId: op.piPaymentId,
    errorMessage: op.errorMessage,
    reviewedAt: op.reviewedAt
  };
}

function adminUsernames() {
  return (process.env.ADMIN_PI_USERNAMES || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// ===========================================================================
// Configuration & connexion
// ===========================================================================

const getConfig = (req, res) => {
  res.json(settings());
};

const authenticate = handle(async (req, res) => {
  const { accessToken } = req.body || {};
  if (!accessToken || typeof accessToken !== 'string') {
    throw httpError(400, 'Jeton Pi manquant.');
  }

  let me;
  try {
    me = await pi.getMe(accessToken);
  } catch (e) {
    throw httpError(401, 'Connexion Pi refusée. Réessayez depuis le Pi Browser.');
  }
  if (!me || !me.uid) {
    throw httpError(401, 'Connexion Pi refusée. Réessayez depuis le Pi Browser.');
  }

  const username = me.username || `pionnier-${String(me.uid).slice(0, 8)}`;

  let user = await User.findOne({ piUid: me.uid });
  if (!user && me.username) {
    // Compte créé avant la connexion Pi : on le rattache à l'identité Pi vérifiée
    user = await User.findOne({ piUsername: me.username });
    if (user) user.piUid = me.uid;
  }
  if (!user) {
    user = new User({ piUid: me.uid, piUsername: username, balance: 0 });
  }

  if (user.status !== 'active') {
    throw httpError(403, 'Ce compte est suspendu. Contactez le support.');
  }

  if (adminUsernames().includes(username.toLowerCase())) {
    user.role = 'admin';
  }

  user.stats = user.stats || {};
  user.stats.lastLogin = new Date();
  user.stats.loginCount = (user.stats.loginCount || 0) + 1;
  await user.save();

  res.json({ token: user.generateAuthToken(), user: publicUser(user) });
});

const getMe = handle(async (req, res) => {
  res.json({ user: publicUser(req.user), settings: settings() });
});

const listOperations = handle(async (req, res) => {
  const ops = await PiOperation.find({ user: req.user._id, status: { $ne: 'cancelled' } })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ operations: ops.map(publicOperation) });
});

// ===========================================================================
// Dépôts (utilisateur -> app)
// ===========================================================================

function checkDepositPayment(payment, user) {
  if (!payment || !payment.identifier) return 'Paiement introuvable.';
  if (payment.user_uid !== user.piUid) return "Ce paiement n'appartient pas à votre compte.";
  if (payment.direction && payment.direction !== 'user_to_app') return "Ce paiement n'est pas un dépôt.";
  if (payment.status && (payment.status.cancelled || payment.status.user_cancelled)) return 'Ce paiement a été annulé.';
  if (!(Number(payment.amount) > 0)) return 'Montant invalide.';
  return null;
}

function recordPendingDeposit(payment, user) {
  return PiOperation.updateOne(
    { piPaymentId: payment.identifier },
    {
      $setOnInsert: {
        user: user._id,
        piUid: user.piUid,
        piUsername: user.piUsername,
        type: 'deposit',
        amount: round7(payment.amount),
        status: 'pending',
        network: payment.network
      }
    },
    { upsert: true }
  );
}

const approveDeposit = handle(async (req, res) => {
  const { paymentId } = req.body || {};
  if (!paymentId || typeof paymentId !== 'string') throw httpError(400, 'Paiement manquant.');

  const payment = await pi.getPayment(paymentId);
  const problem = checkDepositPayment(payment, req.user);
  if (problem) throw httpError(400, problem);

  const { minDeposit } = settings();
  if (payment.amount < minDeposit - EPS) {
    await pi.cancelPayment(paymentId).catch(() => {});
    throw httpError(400, `Le dépôt minimum est de ${fmt(minDeposit)} π.`);
  }

  await recordPendingDeposit(payment, req.user);

  if (!payment.status || !payment.status.developer_approved) {
    await pi.approvePayment(paymentId);
  }

  res.json({ ok: true });
});

/** Finalise un dépôt et crédite le solde une seule fois. */
async function finalizeDeposit(paymentId, txid, user) {
  let payment = await pi.getPayment(paymentId);
  const problem = checkDepositPayment(payment, user);
  if (problem) throw httpError(400, problem);

  const chainTxid = payment.transaction && payment.transaction.txid;
  if (chainTxid && chainTxid !== txid) throw httpError(400, 'Transaction blockchain invalide.');

  await recordPendingDeposit(payment, user);

  if (!payment.status || !payment.status.developer_completed) {
    payment = await pi.completePayment(paymentId, txid);
  }

  const confirmed = payment && payment.status && payment.status.developer_completed &&
    payment.transaction && payment.transaction.txid === txid &&
    payment.transaction.verified !== false;
  if (!confirmed) throw httpError(502, "Pi n'a pas encore confirmé ce paiement. Réessayez dans un instant.");

  const amount = round7(payment.amount);
  const op = await PiOperation.findOneAndUpdate(
    { piPaymentId: paymentId, type: 'deposit', status: { $ne: 'completed' } },
    { $set: { status: 'completed', txid, amount, completedAt: new Date() } },
    { new: true }
  );

  if (op) {
    await User.updateOne({ _id: user._id }, { $inc: { balance: amount, totalEarned: amount } });
  }

  const fresh = await User.findById(user._id);
  return { ok: true, amount, balance: publicUser(fresh).balance, alreadyCredited: !op };
}

const completeDeposit = handle(async (req, res) => {
  const { paymentId, txid } = req.body || {};
  if (!paymentId || !txid || typeof paymentId !== 'string' || typeof txid !== 'string') {
    throw httpError(400, 'Paiement ou transaction manquant.');
  }
  res.json(await finalizeDeposit(paymentId, txid, req.user));
});

const cancelDeposit = handle(async (req, res) => {
  const { paymentId } = req.body || {};
  if (!paymentId || typeof paymentId !== 'string') throw httpError(400, 'Paiement manquant.');
  await PiOperation.updateOne(
    { piPaymentId: paymentId, user: req.user._id, type: 'deposit', status: 'pending' },
    { $set: { status: 'cancelled' } }
  );
  res.json({ ok: true });
});

/**
 * Le SDK Pi signale un paiement resté inachevé (fermeture de l'app, coupure réseau...).
 * S'il a une transaction, on le finalise ; sinon on l'annule pour débloquer l'utilisateur.
 */
const resolveIncompleteDeposit = handle(async (req, res) => {
  const { paymentId } = req.body || {};
  if (!paymentId || typeof paymentId !== 'string') throw httpError(400, 'Paiement manquant.');

  const payment = await pi.getPayment(paymentId);
  if (!payment || payment.user_uid !== req.user.piUid) {
    throw httpError(403, "Ce paiement n'appartient pas à votre compte.");
  }

  const txid = payment.transaction && payment.transaction.txid;
  if (txid) {
    const result = await finalizeDeposit(paymentId, txid, req.user);
    return res.json({ ...result, resolved: 'completed' });
  }

  await pi.cancelPayment(paymentId).catch(() => {});
  await PiOperation.updateOne(
    { piPaymentId: paymentId, type: 'deposit', status: 'pending' },
    { $set: { status: 'cancelled' } }
  );
  res.json({ ok: true, resolved: 'cancelled' });
});

// ===========================================================================
// Retraits (app -> wallet Pi de l'utilisateur)
// ===========================================================================

const requestWithdrawal = handle(async (req, res) => {
  const amount = parseAmount(req.body && req.body.amount);
  const { minWithdrawal, withdrawalFee } = settings();

  if (amount === null) throw httpError(400, 'Entrez un montant valide.');
  if (amount < minWithdrawal - EPS) throw httpError(400, `Le retrait minimum est de ${fmt(minWithdrawal)} π.`);

  const netAmount = round7(amount - withdrawalFee);
  if (netAmount <= 0) throw httpError(400, `Le montant doit dépasser les frais (${fmt(withdrawalFee)} π).`);

  // Débit atomique : impossible de retirer plus que le solde, même avec deux clics rapides
  const user = await User.findOneAndUpdate(
    { _id: req.user._id, status: 'active', balance: { $gte: amount - EPS } },
    { $inc: { balance: -amount, totalSpent: amount } },
    { new: true }
  );
  if (!user) throw httpError(400, 'Solde insuffisant.');

  let op;
  try {
    op = await PiOperation.create({
      user: user._id,
      piUid: user.piUid,
      piUsername: user.piUsername,
      type: 'withdrawal',
      amount,
      fee: withdrawalFee,
      netAmount,
      status: 'pending'
    });
  } catch (error) {
    await User.updateOne({ _id: user._id }, { $inc: { balance: amount, totalSpent: -amount } });
    throw error;
  }

  res.status(201).json({ ok: true, operation: publicOperation(op), balance: publicUser(user).balance });
});

// ===========================================================================
// Admin
// ===========================================================================

const adminListWithdrawals = handle(async (req, res) => {
  const status = String(req.query.status || 'open');
  const filter = { type: 'withdrawal' };
  if (status === 'open') filter.status = { $in: ['pending', 'processing', 'failed'] };
  else if (status !== 'all') filter.status = status;

  const ops = await PiOperation.find(filter)
    .sort({ createdAt: status === 'open' ? 1 : -1 })
    .limit(200);
  res.json({ withdrawals: ops.map(adminOperation) });
});

const adminSummary = handle(async (req, res) => {
  const rows = await PiOperation.aggregate([
    { $match: { status: { $in: ['completed', 'pending', 'processing', 'failed'] } } },
    {
      $group: {
        _id: { type: '$type', status: '$status' },
        amount: { $sum: '$amount' },
        net: { $sum: { $ifNull: ['$netAmount', 0] } },
        count: { $sum: 1 }
      }
    }
  ]);
  const pick = (type, statuses) => rows
    .filter((r) => r._id.type === type && statuses.includes(r._id.status))
    .reduce((acc, r) => ({
      amount: round7(acc.amount + r.amount),
      net: round7(acc.net + r.net),
      count: acc.count + r.count
    }), { amount: 0, net: 0, count: 0 });

  const [balances] = await User.aggregate([
    { $group: { _id: null, total: { $sum: '$balance' }, users: { $sum: 1 } } }
  ]);

  const deposits = pick('deposit', ['completed']);
  const withdrawalsSent = pick('withdrawal', ['completed']);
  const withdrawalsOpen = pick('withdrawal', ['pending', 'processing', 'failed']);
  const userBalances = round7(balances ? balances.total : 0);

  res.json({
    deposits,
    withdrawalsSent,
    withdrawalsOpen,
    userBalances,
    users: balances ? balances.users : 0,
    // Ce que le wallet de l'app doit contenir au minimum pour tout rembourser
    owedToUsers: round7(userBalances + withdrawalsOpen.net)
  });
});

const adminApproveWithdrawal = handle(async (req, res) => {
  const op = await PiOperation.findOneAndUpdate(
    {
      _id: req.params.id,
      type: 'withdrawal',
      $or: [
        { status: { $in: ['pending', 'failed'] } },
        { status: 'processing', updatedAt: { $lt: new Date(Date.now() - STUCK_AFTER_MS) } }
      ]
    },
    { $set: { status: 'processing', reviewedBy: req.user._id, reviewedAt: new Date() } },
    { new: true }
  );
  if (!op) throw httpError(409, 'Ce retrait a déjà été traité ou est en cours.');

  try {
    const client = pi.getA2UClient();

    let paymentId = op.piPaymentId;
    if (!paymentId) {
      try {
        paymentId = await client.createPayment({
          amount: op.netAmount,
          memo: 'Retrait pi-superapp',
          metadata: { operationId: op._id.toString() },
          uid: op.piUid
        });
      } catch (createError) {
        // Un paiement de ce retrait a peut-être été créé avant une coupure
        const result = await client.getIncompleteServerPayments().catch(() => []);
        const incomplete = Array.isArray(result) ? result : (result && result.incomplete_server_payments) || [];
        const mine = incomplete.find((p) => p && p.metadata && p.metadata.operationId === op._id.toString());
        if (!mine) throw createError;
        paymentId = mine.identifier;
      }
      op.piPaymentId = paymentId;
      await op.save();
    }

    const payment = await client.getPayment(paymentId);
    let txid = payment && payment.transaction && payment.transaction.txid;
    if (!txid) {
      txid = await client.submitPayment(paymentId);
    }
    op.txid = txid;
    await op.save();

    if (!payment || !payment.status || !payment.status.developer_completed) {
      await client.completePayment(paymentId, txid);
    }

    op.status = 'completed';
    op.completedAt = new Date();
    op.errorMessage = undefined;
    await op.save();

    res.json({ ok: true, withdrawal: adminOperation(op) });
  } catch (error) {
    const data = error && error.response && error.response.data;
    const message = (data && (data.error_message || data.error)) || (error && error.message) || 'Erreur inconnue';
    console.error('❌ [pi] Retrait échoué', op._id.toString(), message);
    op.status = 'failed';
    op.errorMessage = message;
    await op.save();
    throw httpError(502, `Envoi impossible : ${message}`);
  }
});

const adminRejectWithdrawal = handle(async (req, res) => {
  const reason = String((req.body && req.body.reason) || '').trim().slice(0, 300) || 'Refusé par un administrateur';

  const current = await PiOperation.findOne({ _id: req.params.id, type: 'withdrawal' });
  if (!current) throw httpError(404, 'Retrait introuvable.');
  if (!['pending', 'failed'].includes(current.status)) {
    throw httpError(409, 'Ce retrait ne peut plus être refusé.');
  }
  if (current.txid) {
    throw httpError(409, 'Les Pi ont déjà été envoyés sur la blockchain : cliquez sur « Envoyer » pour terminer.');
  }

  if (current.piPaymentId) {
    const client = pi.getA2UClient();
    const payment = await client.getPayment(current.piPaymentId);
    if (payment && payment.transaction) {
      throw httpError(409, 'Les Pi ont déjà été envoyés sur la blockchain : cliquez sur « Envoyer » pour terminer.');
    }
    await client.cancelPayment(current.piPaymentId).catch(() => {});
  }

  const op = await PiOperation.findOneAndUpdate(
    { _id: current._id, status: { $in: ['pending', 'failed'] }, txid: { $exists: false } },
    { $set: { status: 'rejected', rejectionReason: reason, reviewedBy: req.user._id, reviewedAt: new Date() } },
    { new: true }
  );
  if (!op) throw httpError(409, 'Ce retrait vient d\'être traité par quelqu\'un d\'autre.');

  await User.updateOne({ _id: op.user }, { $inc: { balance: op.amount, totalSpent: -op.amount } });

  res.json({ ok: true, withdrawal: adminOperation(op) });
});

module.exports = {
  getConfig,
  authenticate,
  getMe,
  listOperations,
  approveDeposit,
  completeDeposit,
  cancelDeposit,
  resolveIncompleteDeposit,
  requestWithdrawal,
  adminListWithdrawals,
  adminSummary,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  // exportés pour les tests
  _settings: settings
};
