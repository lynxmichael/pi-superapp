/**
 * Migration unique : les soldes existants viennent de l'ancienne version
 * (100 π offerts à l'inscription, transferts internes...) et ne correspondent
 * à aucun vrai dépôt de Pi. On recalcule chaque solde à partir des opérations
 * réelles : dépôts reçus − retraits (sauf refusés).
 *
 * Exécutée automatiquement une seule fois au démarrage du serveur.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const PiOperation = require('../models/PiOperation');

const MIGRATION_ID = 'balances-from-pi-operations-v1';

async function migrateBalances() {
  const migrations = mongoose.connection.collection('app_migrations');
  if (await migrations.findOne({ _id: MIGRATION_ID })) return;

  const totals = await PiOperation.aggregate([
    {
      $match: {
        $or: [
          { type: { $in: PiOperation.IN_TYPES }, status: 'completed' },
          { type: { $in: PiOperation.OUT_TYPES }, status: { $in: ['pending', 'processing', 'failed', 'held', 'completed'] } }
        ]
      }
    },
    {
      $group: {
        _id: '$user',
        total: { $sum: { $cond: [{ $in: ['$type', PiOperation.IN_TYPES] }, '$amount', { $multiply: ['$amount', -1] }] } }
      }
    }
  ]);
  const backed = new Map(totals.map((t) => [String(t._id), Math.max(0, Math.round(t.total * 1e7) / 1e7)]));

  let changed = 0;
  const users = await User.find({}, { balance: 1 }).lean();
  for (const user of users) {
    const real = backed.get(String(user._id)) || 0;
    if ((user.balance || 0) !== real) {
      await User.updateOne({ _id: user._id }, { $set: { balance: real } });
      changed += 1;
    }
  }

  await migrations.insertOne({ _id: MIGRATION_ID, doneAt: new Date(), usersChanged: changed });
  if (changed > 0) {
    console.log(`🔧 ${changed} ancien(s) solde(s) fictif(s) remis à la valeur réelle des dépôts Pi`);
  }
}

module.exports = migrateBalances;
