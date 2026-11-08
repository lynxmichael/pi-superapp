/**
 * Tests de bout en bout des dépôts et retraits.
 * Nécessite un MongoDB local : MONGODB_TEST_URI (par défaut mongodb://127.0.0.1:27017/pi-superapp-test).
 * Le serveur Pi est simulé ; la base de test est vidée au début.
 *
 *   npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Faux serveur Pi Platform
// ---------------------------------------------------------------------------
const fake = {
  users: { 'tok-alice': { uid: 'uid-alice', username: 'alice' }, 'tok-bob': { uid: 'uid-bob', username: 'bob' }, 'tok-admin': { uid: 'uid-admin', username: 'chef' } },
  payments: {},
  calls: []
};

function u2a(id, uid, amount, extra = {}) {
  fake.payments[id] = {
    identifier: id, user_uid: uid, amount, memo: 'Dépôt', metadata: { type: 'deposit' },
    direction: 'user_to_app', network: 'Pi Testnet',
    status: { developer_approved: false, transaction_verified: false, developer_completed: false, cancelled: false, user_cancelled: false },
    transaction: null,
    ...extra
  };
  return fake.payments[id];
}

const piServer = express();
piServer.use(express.json());
piServer.get('/v2/me', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user = fake.users[token];
  if (!user) return res.status(401).json({ error: 'invalid_token' });
  res.json({ uid: user.uid, username: user.username, credentials: { scopes: ['username', 'payments'] } });
});
piServer.use('/v2/payments', (req, res, next) => {
  if (req.headers.authorization !== 'Key test-key') return res.status(401).json({ error: 'bad key' });
  next();
});
piServer.get('/v2/payments/:id', (req, res) => {
  const p = fake.payments[req.params.id];
  if (!p) return res.status(404).json({ error: 'payment_not_found' });
  res.json(p);
});
piServer.post('/v2/payments/:id/approve', (req, res) => {
  const p = fake.payments[req.params.id];
  fake.calls.push(['approve', req.params.id]);
  p.status.developer_approved = true;
  res.json(p);
});
piServer.post('/v2/payments/:id/complete', (req, res) => {
  const p = fake.payments[req.params.id];
  fake.calls.push(['complete', req.params.id]);
  if (!p.transaction || p.transaction.txid !== req.body.txid) return res.status(400).json({ error_message: 'txid mismatch' });
  p.status.developer_completed = true;
  res.json(p);
});
piServer.post('/v2/payments/:id/cancel', (req, res) => {
  const p = fake.payments[req.params.id];
  fake.calls.push(['cancel', req.params.id]);
  if (p) p.status.cancelled = true;
  res.json(p || {});
});

// Faux client A2U (remplace pi-backend)
const a2u = {
  fail: null,
  sent: [],
  payments: {},
  async createPayment(data) {
    if (a2u.fail === 'create') throw new Error('Pi indisponible');
    const id = `a2u-${Object.keys(a2u.payments).length + 1}`;
    a2u.payments[id] = { identifier: id, ...data, transaction: null, status: { developer_completed: false } };
    return id;
  },
  async getPayment(id) { return a2u.payments[id]; },
  async submitPayment(id) {
    if (a2u.fail === 'submit') throw new Error('Wallet de l\'app vide');
    const txid = `tx-${id}`;
    a2u.payments[id].transaction = { txid, verified: true };
    a2u.sent.push({ id, amount: a2u.payments[id].amount, uid: a2u.payments[id].uid });
    return txid;
  },
  async completePayment(id) {
    if (a2u.fail === 'complete') throw new Error('Timeout');
    a2u.payments[id].status.developer_completed = true;
    return a2u.payments[id];
  },
  async cancelPayment(id) { a2u.payments[id].status.cancelled = true; return a2u.payments[id]; },
  async getIncompleteServerPayments() { return []; }
};

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------
let base;
let appServer;
let piHttp;
const tokens = {};

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* pas de JSON */ }
  return { status: res.status, data };
}

const balanceOf = async (who) => (await call('GET', '/api/pi/me', null, tokens[who])).data.user.balance;

test.before(async () => {
  piHttp = await new Promise((resolve) => { const s = piServer.listen(0, () => resolve(s)); });

  Object.assign(process.env, {
    MONGODB_URI: process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/pi-superapp-test',
    JWT_SECRET: 'secret-de-test',
    PI_API_KEY: 'test-key',
    PI_API_BASE: `http://127.0.0.1:${piHttp.address().port}/v2`,
    MIN_DEPOSIT: '0.01',
    MIN_WITHDRAWAL: '1',
    WITHDRAWAL_FEE: '0.01',
    ADMIN_PI_USERNAMES: 'chef',
    ENABLE_LEGACY_SERVICES: 'false',
    NODE_ENV: 'test'
  });

  // Base "ancienne" : index uniques non-sparse sur email et wallet, comme avant la mise à jour
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  const users = mongoose.connection.collection('users');
  await users.createIndex({ email: 1 }, { unique: true, name: 'email_1' });
  await users.createIndex({ walletAddress: 1 }, { unique: true, name: 'walletAddress_1' });
  // Compte de l'ancienne version, avec les 100 π offerts à l'inscription
  await users.insertOne({ piUsername: 'alice', piUid: 'saisi-a-la-main', walletAddress: 'GOLD', email: 'alice@example.com', balance: 100, status: 'active', role: 'user', stats: { loginCount: 0 } });
  await mongoose.disconnect();

  const { app, initializeApp } = require('../server');
  require('../services/piPlatform').setA2UClient(a2u);
  await initializeApp();
  appServer = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  base = `http://127.0.0.1:${appServer.address().port}`;
});

test.after(async () => {
  await new Promise((r) => appServer.close(r));
  await new Promise((r) => piHttp.close(r));
  await mongoose.disconnect();
});

// ---------------------------------------------------------------------------

test('config publique', async () => {
  const { status, data } = await call('GET', '/api/pi/config');
  assert.equal(status, 200);
  assert.equal(data.minWithdrawal, 1);
  assert.equal(data.withdrawalFee, 0.01);
});

test('connexion Pi : ancien compte rattaché, solde fictif remis à 0 ; nouveaux comptes à 0 π sans email ni wallet', async () => {
  for (const who of ['alice', 'bob', 'admin']) {
    const { status, data } = await call('POST', '/api/pi/auth', { accessToken: `tok-${who}` });
    assert.equal(status, 200, JSON.stringify(data));
    assert.equal(data.user.balance, 0);
    tokens[who] = data.token;
  }
  const me = await call('GET', '/api/pi/me', null, tokens.admin);
  assert.equal(me.data.user.role, 'admin');
  const alice = await call('GET', '/api/pi/me', null, tokens.alice);
  assert.equal(alice.data.user.role, 'user');
  const legacy = await mongoose.connection.collection('users').findOne({ email: 'alice@example.com' });
  assert.equal(String(legacy._id), String(alice.data.user.id), 'ancien compte rattaché par nom d\'utilisateur');
  assert.equal(legacy.piUid, 'uid-alice');
  assert.equal(legacy.balance, 0);

  // Se reconnecter ne crée pas de doublon
  const again = await call('POST', '/api/pi/auth', { accessToken: 'tok-alice' });
  assert.equal(String(again.data.user.id), String(alice.data.user.id));
});

test('connexion refusée avec un faux jeton', async () => {
  const { status } = await call('POST', '/api/pi/auth', { accessToken: 'faux' });
  assert.equal(status, 401);
});

test('les anciennes routes dangereuses ne sont plus accessibles', async () => {
  assert.equal((await call('POST', '/api/auth/login', { piUsername: 'alice' })).status, 404);
  assert.equal((await call('POST', '/api/wallet/transfer', { toAddress: 'G', amount: -5 }, tokens.alice)).status, 404);
  assert.equal((await call('POST', '/api/payments/create', {}, tokens.alice)).status, 404);
});

test('dépôt : approuvé puis crédité une seule fois', async () => {
  u2a('pay-1', 'uid-alice', 10);
  let r = await call('POST', '/api/pi/deposits/approve', { paymentId: 'pay-1' }, tokens.alice);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(fake.calls.some(([k, id]) => k === 'approve' && id === 'pay-1'));

  // Transaction blockchain faite par l'utilisateur
  fake.payments['pay-1'].transaction = { txid: 'tx-1', verified: true };
  r = await call('POST', '/api/pi/deposits/complete', { paymentId: 'pay-1', txid: 'tx-1' }, tokens.alice);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.amount, 10);
  assert.equal(r.data.balance, 10);

  r = await call('POST', '/api/pi/deposits/complete', { paymentId: 'pay-1', txid: 'tx-1' }, tokens.alice);
  assert.equal(r.data.alreadyCredited, true);
  assert.equal(await balanceOf('alice'), 10);
});

test('dépôt : plusieurs confirmations simultanées ne créditent qu\'une fois', async () => {
  u2a('pay-2', 'uid-alice', 5, { transaction: { txid: 'tx-2', verified: true } });
  fake.payments['pay-2'].status.developer_approved = true;
  const results = await Promise.all(Array.from({ length: 6 }, () =>
    call('POST', '/api/pi/deposits/complete', { paymentId: 'pay-2', txid: 'tx-2' }, tokens.alice)));
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(await balanceOf('alice'), 15);
});

test('dépôt : refusé pour le paiement d\'un autre ou un mauvais txid', async () => {
  u2a('pay-bob', 'uid-bob', 100, { transaction: { txid: 'tx-bob', verified: true } });
  let r = await call('POST', '/api/pi/deposits/approve', { paymentId: 'pay-bob' }, tokens.alice);
  assert.equal(r.status, 400);
  r = await call('POST', '/api/pi/deposits/complete', { paymentId: 'pay-bob', txid: 'tx-bob' }, tokens.alice);
  assert.equal(r.status, 400);

  u2a('pay-3', 'uid-alice', 7, { transaction: { txid: 'tx-3', verified: true } });
  r = await call('POST', '/api/pi/deposits/complete', { paymentId: 'pay-3', txid: 'tx-autre' }, tokens.alice);
  assert.equal(r.status, 400);
  assert.equal(await balanceOf('alice'), 15);
});

test('dépôt : paiement inachevé terminé ou annulé à la reconnexion', async () => {
  u2a('pay-4', 'uid-bob', 3, { transaction: { txid: 'tx-4', verified: true } });
  let r = await call('POST', '/api/pi/deposits/incomplete', { paymentId: 'pay-4' }, tokens.bob);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.resolved, 'completed');
  assert.equal(await balanceOf('bob'), 3);

  u2a('pay-5', 'uid-bob', 3);
  r = await call('POST', '/api/pi/deposits/incomplete', { paymentId: 'pay-5' }, tokens.bob);
  assert.equal(r.data.resolved, 'cancelled');
  assert.ok(fake.calls.some(([k, id]) => k === 'cancel' && id === 'pay-5'));
  assert.equal(await balanceOf('bob'), 3);
});

test('retrait : montants invalides refusés', async () => {
  for (const amount of [-5, 0, 'abc', 0.5, 1000]) {
    const r = await call('POST', '/api/pi/withdrawals', { amount }, tokens.alice);
    assert.equal(r.status, 400, `montant ${amount}`);
  }
  assert.equal(await balanceOf('alice'), 15);
});

test('retrait : réserve les fonds, impossible de dépenser deux fois', async () => {
  const r = await call('POST', '/api/pi/withdrawals', { amount: '4,5' }, tokens.alice);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.operation.netAmount, 4.49);
  assert.equal(r.data.balance, 10.5);

  // 3 demandes de 10,5 en même temps : une seule passe
  const many = await Promise.all([1, 2, 3].map(() => call('POST', '/api/pi/withdrawals', { amount: 10.5 }, tokens.alice)));
  assert.equal(many.filter((x) => x.status === 201).length, 1);
  assert.equal(await balanceOf('alice'), 0);
});

test('admin : un utilisateur normal n\'y a pas accès', async () => {
  assert.equal((await call('GET', '/api/pi/admin/withdrawals', null, tokens.alice)).status, 403);
  assert.equal((await call('GET', '/api/pi/admin/withdrawals')).status, 401);
});

test('admin : envoi d\'un retrait', async () => {
  const list = await call('GET', '/api/pi/admin/withdrawals', null, tokens.admin);
  assert.equal(list.data.withdrawals.length, 2);
  const first = list.data.withdrawals[0];
  assert.equal(first.amount, 4.5);

  const r = await call('POST', `/api/pi/admin/withdrawals/${first.id}/approve`, null, tokens.admin);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.withdrawal.status, 'completed');
  assert.ok(r.data.withdrawal.txid);
  assert.deepEqual(a2u.sent.at(-1), { id: a2u.sent.at(-1).id, amount: 4.49, uid: 'uid-alice' });

  const twice = await call('POST', `/api/pi/admin/withdrawals/${first.id}/approve`, null, tokens.admin);
  assert.equal(twice.status, 409);
  assert.equal(a2u.sent.length, 1);
});

test('admin : échec d\'envoi puis nouvel essai réussi', async () => {
  const list = await call('GET', '/api/pi/admin/withdrawals', null, tokens.admin);
  const w = list.data.withdrawals[0];

  a2u.fail = 'submit';
  let r = await call('POST', `/api/pi/admin/withdrawals/${w.id}/approve`, null, tokens.admin);
  assert.equal(r.status, 502);
  const after = await call('GET', '/api/pi/admin/withdrawals', null, tokens.admin);
  assert.equal(after.data.withdrawals[0].status, 'failed');
  assert.match(after.data.withdrawals[0].errorMessage, /vide/);
  assert.equal(await balanceOf('alice'), 0, 'les fonds restent réservés');

  a2u.fail = null;
  r = await call('POST', `/api/pi/admin/withdrawals/${w.id}/approve`, null, tokens.admin);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(a2u.sent.length, 2);
  assert.equal(Object.keys(a2u.payments).length, 2, 'le paiement Pi déjà créé est réutilisé');
});

test('admin : refus d\'un retrait, les Pi sont rendus', async () => {
  const req = await call('POST', '/api/pi/withdrawals', { amount: 2 }, tokens.bob);
  assert.equal(req.status, 201);
  assert.equal(await balanceOf('bob'), 1);

  const r = await call('POST', `/api/pi/admin/withdrawals/${req.data.operation.id}/reject`, { reason: 'Vérification nécessaire' }, tokens.admin);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(await balanceOf('bob'), 3);

  const again = await call('POST', `/api/pi/admin/withdrawals/${req.data.operation.id}/reject`, {}, tokens.admin);
  assert.equal(again.status, 409);
  assert.equal(await balanceOf('bob'), 3, 'pas de double remboursement');

  const ops = await call('GET', '/api/pi/operations', null, tokens.bob);
  const rejected = ops.data.operations.find((o) => o.status === 'rejected');
  assert.equal(rejected.rejectionReason, 'Vérification nécessaire');
});

test('admin : refus impossible si les Pi sont déjà partis', async () => {
  const req = await call('POST', '/api/pi/withdrawals', { amount: 1.5 }, tokens.bob);
  a2u.fail = 'complete';
  const r = await call('POST', `/api/pi/admin/withdrawals/${req.data.operation.id}/approve`, null, tokens.admin);
  assert.equal(r.status, 502);
  a2u.fail = null;

  const refuse = await call('POST', `/api/pi/admin/withdrawals/${req.data.operation.id}/reject`, {}, tokens.admin);
  assert.equal(refuse.status, 409);
  assert.equal(await balanceOf('bob'), 1.5);

  const retry = await call('POST', `/api/pi/admin/withdrawals/${req.data.operation.id}/approve`, null, tokens.admin);
  assert.equal(retry.status, 200);
  assert.equal(a2u.sent.filter((s) => s.uid === 'uid-bob').length, 1, 'pas de second envoi blockchain');
});

test('admin : chiffres clés', async () => {
  const { status, data } = await call('GET', '/api/pi/admin/summary', null, tokens.admin);
  assert.equal(status, 200);
  assert.equal(data.deposits.amount, 18); // 10 + 5 + 3
  assert.equal(data.deposits.count, 3);
  assert.equal(data.withdrawalsSent.count, 3);
  assert.equal(data.withdrawalsOpen.count, 0);
  assert.equal(data.userBalances, 1.5);
  assert.equal(data.owedToUsers, 1.5);
});

test('un id invalide renvoie 404 et pas une erreur serveur', async () => {
  const r = await call('POST', '/api/pi/admin/withdrawals/pas-un-id/approve', null, tokens.admin);
  assert.equal(r.status, 404);
});
