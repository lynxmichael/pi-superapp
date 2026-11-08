/**
 * Tests de bout en bout des services : KYC, marketplace (séquestre), recharges, réservations,
 * abonnements, jeux, fichiers. Base MongoDB locale de test (vidée au début), faux serveur Pi.
 *
 *   npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');

const fakeUsers = {
  'tok-vendeur': { uid: 'uid-vendeur', username: 'vendeur' },
  'tok-acheteur': { uid: 'uid-acheteur', username: 'acheteur' },
  'tok-autre': { uid: 'uid-autre', username: 'autre' },
  'tok-admin': { uid: 'uid-admin', username: 'patron' }
};
const piServer = express();
piServer.get('/v2/me', (req, res) => {
  const u = fakeUsers[(req.headers.authorization || '').replace('Bearer ', '')];
  return u ? res.json(u) : res.status(401).end();
});

let base;
let appServer;
let piHttp;
const T = {};
const ids = {};

async function call(method, path, body, who, { form } = {}) {
  const headers = who ? { Authorization: `Bearer ${T[who]}` } : {};
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + path, { method, headers, body: payload });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
  return { status: res.status, data, headers: res.headers };
}

const db = () => mongoose.connection;
const balance = async (who) => (await call('GET', '/api/pi/me', null, who)).data.user.balance;
const setBalance = (who, value) => db().collection('users').updateOne({ _id: new mongoose.Types.ObjectId(ids[who]) }, { $set: { balance: value } });
const verify = (who) => db().collection('users').updateOne({ _id: new mongoose.Types.ObjectId(ids[who]) }, { $set: { 'verification.kycStatus': 'approved' } });

function png(bytes = 64) {
  // Petit PNG valide (1x1) complété à la taille voulue
  const head = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
  return Buffer.concat([head, Buffer.alloc(Math.max(0, bytes - head.length))]);
}

test.before(async () => {
  piHttp = await new Promise((r) => { const s = piServer.listen(0, () => r(s)); });
  Object.assign(process.env, {
    MONGODB_URI: process.env.MONGODB_TEST_URI_SERVICES || 'mongodb://127.0.0.1:27017/pi-superapp-test-services',
    JWT_SECRET: 'secret-de-test',
    PI_API_KEY: 'test-key',
    PI_API_BASE: `http://127.0.0.1:${piHttp.address().port}/v2`,
    ADMIN_PI_USERNAMES: 'patron',
    FILES_QUOTA_MB: '1',
    NODE_ENV: 'test'
  });
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  const { app, initializeApp } = require('../server');
  await initializeApp();
  appServer = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  base = `http://127.0.0.1:${appServer.address().port}`;

  for (const who of ['vendeur', 'acheteur', 'autre', 'admin']) {
    const { data } = await call('POST', '/api/pi/auth', { accessToken: `tok-${who}` });
    T[who] = data.token;
    ids[who] = data.user.id;
  }
  await setBalance('acheteur', 100);
  await setBalance('autre', 30);
});

test.after(async () => {
  await new Promise((r) => appServer.close(r));
  await new Promise((r) => piHttp.close(r));
  await mongoose.disconnect();
});

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

test('KYC : sans vérification, impossible de vendre ou de proposer une offre', async () => {
  const p = await call('POST', '/api/market/products', { name: 'Test', description: 'Un produit', price: 5 }, 'vendeur');
  assert.equal(p.status, 403);
  const o = await call('POST', '/api/offers', { kind: 'booking', title: 'Hôtel', description: 'Une belle chambre', price: 5 }, 'vendeur');
  assert.equal(o.status, 403);
});

test('KYC : envoi des documents, qui restent privés', async () => {
  const form = new FormData();
  for (const [k, v] of Object.entries({
    firstName: 'Awa', lastName: 'Koné', dateOfBirth: '1995-04-12', nationality: 'Ivoirienne',
    address: 'Cocody, Abidjan', phone: '+2250700000000', documentType: 'id_card', documentNumber: 'CI123456'
  })) form.append(k, v);
  for (const f of ['docFront', 'docBack', 'selfie']) form.append(f, new Blob([png()], { type: 'image/png' }), `${f}.png`);

  const r = await call('POST', '/api/account/kyc', null, 'vendeur', { form });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const acc = await call('GET', '/api/account', null, 'vendeur');
  assert.equal(acc.data.account.kyc.status, 'pending');

  const user = await db().collection('users').findOne({ _id: new mongoose.Types.ObjectId(ids.vendeur) });
  const front = user.verification.kycDocuments.frontImage;
  const name = front.split('/').pop();

  const pub = await fetch(base + front);
  assert.notEqual(pub.headers.get('content-type'), 'image/png', 'le document KYC ne doit pas être public');
  assert.equal((await call('GET', `/api/admin/kyc-file/${name}`, null, 'acheteur')).status, 403);
  const adm = await fetch(`${base}/api/admin/kyc-file/${name}`, { headers: { Authorization: `Bearer ${T.admin}` } });
  assert.equal(adm.status, 200);
  assert.equal(adm.headers.get('content-type'), 'image/png');

  // L'admin approuve
  const ok = await call('PUT', `/api/admin/kyc/${ids.vendeur}/approve`, {}, 'admin');
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal((await call('GET', '/api/pi/me', null, 'vendeur')).data.user.verified, true);
});

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

test('marketplace : le vendeur vérifié publie un produit avec photo', async () => {
  await call('PUT', '/api/admin/settings', { marketCommissionPercent: 10, offersCommissionPercent: 5 }, 'admin');
  const form = new FormData();
  form.append('name', 'Téléphone Tecno');
  form.append('description', 'Comme neuf, avec chargeur');
  form.append('price', '20');
  form.append('stock', '3');
  form.append('category', 'electronics');
  form.append('city', 'Abidjan');
  form.append('images', new Blob([png()], { type: 'image/png' }), 'tel.png');
  const r = await call('POST', '/api/market/products', null, 'vendeur', { form });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  ids.product = r.data.product.id;
  const img = await fetch(base + r.data.product.images[0]);
  assert.equal(img.status, 200);

  const list = await call('GET', '/api/market/products?q=tecno');
  assert.equal(list.data.products.length, 1);
  assert.equal(list.data.products[0].seller.piUsername, 'vendeur');
});

test('marketplace : achat bloque les Pi, le vendeur est payé à la réception', async () => {
  const self = await call('POST', `/api/market/products/${ids.product}/buy`, { quantity: 1, deliveryNote: 'Cocody, 0700000000' }, 'vendeur');
  assert.equal(self.status, 400);

  const r = await call('POST', `/api/market/products/${ids.product}/buy`, { quantity: 2, deliveryNote: 'Cocody, 0700000000' }, 'acheteur');
  assert.equal(r.status, 201, JSON.stringify(r.data));
  ids.order1 = r.data.order.id;
  assert.equal(await balance('acheteur'), 60);
  assert.equal(await balance('vendeur'), 0, 'le vendeur n\'est pas encore payé');
  const p = await call('GET', `/api/market/products/${ids.product}`);
  assert.equal(p.data.product.stock, 1);

  assert.equal((await call('POST', `/api/market/orders/${ids.order1}/confirm`, {}, 'vendeur')).status, 409);
  assert.equal((await call('POST', `/api/market/orders/${ids.order1}/ship`, { note: 'Livreur demain' }, 'vendeur')).status, 200);
  const c = await call('POST', `/api/market/orders/${ids.order1}/confirm`, {}, 'acheteur');
  assert.equal(c.status, 200, JSON.stringify(c.data));
  assert.equal(c.data.order.sellerAmount, 36); // 40 − 10 %
  assert.equal(await balance('vendeur'), 36);
  assert.equal((await call('POST', `/api/market/orders/${ids.order1}/confirm`, {}, 'acheteur')).status, 409);
  assert.equal(await balance('vendeur'), 36, 'pas de double paiement');

  const hist = await call('GET', '/api/pi/operations', null, 'acheteur');
  const purchase = hist.data.operations.find((o) => o.type === 'purchase');
  assert.equal(purchase.label, 'Achat : Téléphone Tecno');
  assert.equal(purchase.status, 'completed');
});

test('marketplace : un seul acheteur obtient le dernier exemplaire', async () => {
  await setBalance('autre', 30);
  const results = await Promise.all([
    call('POST', `/api/market/products/${ids.product}/buy`, { quantity: 1, deliveryNote: 'Yopougon, 0101' }, 'acheteur'),
    call('POST', `/api/market/products/${ids.product}/buy`, { quantity: 1, deliveryNote: 'Plateau, 0202' }, 'autre')
  ]);
  const ok = results.filter((r) => r.status === 201);
  assert.equal(ok.length, 1);
  const total = (await balance('acheteur')) + (await balance('autre'));
  assert.equal(total, 60 + 30 - 20);
  ids.order2 = ok[0].data.order.id;
  ids.order2buyer = results[0].status === 201 ? 'acheteur' : 'autre';
});

test('marketplace : annulation et litige remboursent l\'acheteur', async () => {
  const buyer = ids.order2buyer;
  const before = await balance(buyer);
  const c = await call('POST', `/api/market/orders/${ids.order2}/cancel`, { reason: 'Je change d\'avis' }, buyer);
  assert.equal(c.status, 200, JSON.stringify(c.data));
  assert.equal(await balance(buyer), before + 20);
  assert.equal((await call('GET', `/api/market/products/${ids.product}`)).data.product.stock, 1, 'stock remis');

  // Litige -> l'admin rembourse
  const b = await call('POST', `/api/market/products/${ids.product}/buy`, { quantity: 1, deliveryNote: 'Marcory, 0303' }, 'acheteur');
  const orderId = b.data.order.id;
  await call('POST', `/api/market/orders/${orderId}/ship`, {}, 'vendeur');
  assert.equal((await call('POST', `/api/market/orders/${orderId}/cancel`, {}, 'acheteur')).status, 409, 'déjà envoyé');
  assert.equal((await call('POST', `/api/market/orders/${orderId}/dispute`, { reason: 'Jamais reçu' }, 'acheteur')).status, 200);
  const disputes = await call('GET', '/api/admin/disputes', null, 'admin');
  assert.equal(disputes.data.orders.length, 1);
  const before2 = await balance('acheteur');
  const res = await call('POST', `/api/admin/disputes/${orderId}/resolve`, { decision: 'refund' }, 'admin');
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(await balance('acheteur'), before2 + 20);
  assert.equal((await call('POST', `/api/admin/disputes/${orderId}/resolve`, { decision: 'release' }, 'admin')).status, 409);
});

test('marketplace : solde insuffisant, le stock n\'est pas perdu', async () => {
  await setBalance('autre', 1);
  const r = await call('POST', `/api/market/products/${ids.product}/buy`, { quantity: 1, deliveryNote: 'Bingerville, 0404' }, 'autre');
  assert.equal(r.status, 400);
  assert.match(r.data.error, /Solde insuffisant/);
  assert.equal((await call('GET', `/api/market/products/${ids.product}`)).data.product.stock, 1);
});

// ---------------------------------------------------------------------------
// Recharges
// ---------------------------------------------------------------------------

test('recharge : fermée tant que l\'admin n\'a pas fixé de taux', async () => {
  const r = await call('POST', '/api/recharge', { kind: 'mobile', operator: 'Orange', recipient: '0700000000', localAmount: 1000 }, 'acheteur');
  assert.equal(r.status, 400);
});

test('recharge : payée au taux de l\'admin, puis faite ou refusée', async () => {
  assert.equal((await call('PUT', '/api/admin/settings', { rechargeRate: 500, rechargeFeePercent: 2 }, 'acheteur')).status, 403);
  const s = await call('PUT', '/api/admin/settings', { rechargeRate: 500, rechargeFeePercent: 2 }, 'admin');
  assert.equal(s.status, 200, JSON.stringify(s.data));
  const cfg = await call('GET', '/api/pi/config');
  assert.equal(cfg.data.recharge.open, true);

  const before = await balance('acheteur');
  const r = await call('POST', '/api/recharge', { kind: 'mobile', operator: 'Orange', recipient: '07 00 00 00 00', localAmount: 1000 }, 'acheteur');
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.recharge.piAmount, 2.04); // 1000 / 500 × 1,02
  assert.equal(await balance('acheteur'), before - 2.04);

  assert.equal((await call('GET', '/api/admin/recharges', null, 'acheteur')).status, 403);
  const list = await call('GET', '/api/admin/recharges', null, 'admin');
  assert.equal(list.data.recharges.length, 1);
  const done = await call('POST', `/api/admin/recharges/${r.data.recharge.id}/done`, { reference: 'OM-123' }, 'admin');
  assert.equal(done.status, 200);
  assert.equal((await call('POST', `/api/admin/recharges/${r.data.recharge.id}/refuse`, {}, 'admin')).status, 409);

  const r2 = await call('POST', '/api/recharge', { kind: 'electricity', operator: 'CIE', recipient: '123456789', localAmount: 5000 }, 'acheteur');
  assert.equal(r2.status, 201);
  const ref = await call('POST', `/api/admin/recharges/${r2.data.recharge.id}/refuse`, { reason: 'Compteur inconnu' }, 'admin');
  assert.equal(ref.status, 200);
  assert.equal(await balance('acheteur'), before - 2.04);
  const mine = await call('GET', '/api/recharge', null, 'acheteur');
  assert.equal(mine.data.recharges.find((x) => x.status === 'refused').refuseReason, 'Compteur inconnu');
});

// ---------------------------------------------------------------------------
// Réservations et abonnements
// ---------------------------------------------------------------------------

test('réservation : Pi bloqués, commerçant payé à l\'acceptation', async () => {
  const offer = await call('POST', '/api/offers', {
    kind: 'booking', title: 'Chambre double', description: 'Hôtel au bord de la lagune', price: 5, unit: 'nuit', category: 'hotel', city: 'Assinie'
  }, 'vendeur');
  assert.equal(offer.status, 201, JSON.stringify(offer.data));
  ids.booking = offer.data.offer.id;

  const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  assert.equal((await call('POST', `/api/offers/${ids.booking}/book`, { date: '2020-01-01', quantity: 1 }, 'acheteur')).status, 400);

  const vendeurBefore = await balance('vendeur');
  const before = await balance('acheteur');
  const b = await call('POST', `/api/offers/${ids.booking}/book`, { date: day, quantity: 2, note: 'Arrivée 18 h' }, 'acheteur');
  assert.equal(b.status, 201, JSON.stringify(b.data));
  assert.equal(await balance('acheteur'), before - 10);

  const received = await call('GET', '/api/offers/bookings?role=merchant', null, 'vendeur');
  assert.equal(received.data.bookings.length, 1);
  const acc = await call('POST', `/api/offers/bookings/${b.data.booking.id}/accept`, {}, 'vendeur');
  assert.equal(acc.status, 200, JSON.stringify(acc.data));
  assert.equal(await balance('vendeur'), vendeurBefore + 9.5); // 10 − 5 %
  assert.equal((await call('POST', `/api/offers/bookings/${b.data.booking.id}/accept`, {}, 'vendeur')).status, 409);

  const b2 = await call('POST', `/api/offers/${ids.booking}/book`, { date: day, quantity: 1 }, 'acheteur');
  assert.equal((await call('POST', `/api/offers/bookings/${b2.data.booking.id}/cancel`, {}, 'acheteur')).status, 200);
  const b3 = await call('POST', `/api/offers/${ids.booking}/book`, { date: day, quantity: 1 }, 'acheteur');
  assert.equal((await call('POST', `/api/offers/bookings/${b3.data.booking.id}/refuse`, { reason: 'Complet' }, 'vendeur')).status, 200);
  assert.equal(await balance('acheteur'), before - 10, 'annulation et refus remboursés');
});

test('abonnement : chaque paiement prolonge d\'une période', async () => {
  const offer = await call('POST', '/api/offers', {
    kind: 'subscription', title: 'Salle de sport', description: 'Accès illimité à la salle', price: 3, period: 'month', category: 'sport'
  }, 'vendeur');
  assert.equal(offer.status, 201, JSON.stringify(offer.data));
  const vendeurBefore = await balance('vendeur');

  const s1 = await call('POST', `/api/offers/${offer.data.offer.id}/subscribe`, {}, 'acheteur');
  assert.equal(s1.status, 201, JSON.stringify(s1.data));
  const s2 = await call('POST', `/api/offers/${offer.data.offer.id}/subscribe`, {}, 'acheteur');
  const end1 = new Date(s1.data.membership.endDate);
  const end2 = new Date(s2.data.membership.endDate);
  assert.ok(end2 - end1 > 27 * 86400000, 'prolongé d\'environ un mois');
  assert.equal(await balance('vendeur'), vendeurBefore + 2 * 2.85);

  const subs = await call('GET', '/api/offers/memberships?role=merchant', null, 'vendeur');
  assert.equal(subs.data.memberships.length, 1);
  assert.equal(subs.data.memberships[0].payments, 2);
});

// ---------------------------------------------------------------------------
// Jeux et fichiers
// ---------------------------------------------------------------------------

test('jeux : scores sans Pi, classement', async () => {
  const before = await balance('acheteur');
  assert.equal((await call('POST', '/api/games/calcul/scores', { score: 999999 }, 'acheteur')).status, 400);
  assert.equal((await call('POST', '/api/games/calcul/scores', { score: 25 }, 'acheteur')).status, 201);
  assert.equal((await call('POST', '/api/games/calcul/scores', { score: 30 }, 'acheteur')).status, 429);
  assert.equal((await call('POST', '/api/games/calcul/scores', { score: 40 }, 'autre')).status, 201);
  const lb = await call('GET', '/api/games/calcul/leaderboard');
  assert.deepEqual(lb.data.leaderboard.map((r) => r.piUsername), ['autre', 'acheteur']);
  assert.equal(await balance('acheteur'), before, 'aucun gain en Pi');
  assert.equal((await call('POST', '/api/games/inconnu/scores', { score: 1 }, 'acheteur')).status, 404);
});

test('fichiers : privés, quota respecté', async () => {
  const form = new FormData();
  form.append('file', new Blob(['Bonjour pi-superapp'], { type: 'text/plain' }), 'note.txt');
  const up = await call('POST', '/api/files', null, 'acheteur', { form });
  assert.equal(up.status, 201, JSON.stringify(up.data));
  const id = up.data.file.id;

  const dl = await fetch(`${base}/api/files/${id}/download`, { headers: { Authorization: `Bearer ${T.acheteur}` } });
  assert.equal(await dl.text(), 'Bonjour pi-superapp');
  assert.equal((await call('GET', `/api/files/${id}/download`, null, 'autre')).status, 404, 'invisible pour les autres');

  const bad = new FormData();
  bad.append('file', new Blob(['<script>'], { type: 'text/html' }), 'page.html');
  assert.equal((await call('POST', '/api/files', null, 'acheteur', { form: bad })).status, 400);

  const big = new FormData();
  big.append('file', new Blob([Buffer.alloc(1.2 * 1024 * 1024)], { type: 'application/pdf' }), 'gros.pdf');
  const over = await call('POST', '/api/files', null, 'acheteur', { form: big });
  assert.equal(over.status, 400);
  assert.match(over.data.error, /Espace plein/);

  assert.equal((await call('DELETE', `/api/files/${id}`, null, 'acheteur')).status, 200);
  assert.equal((await call('GET', '/api/files', null, 'acheteur')).data.files.length, 0);
});

// ---------------------------------------------------------------------------

test('admin : les Pi bloqués comptent dans ce que l\'app doit garder', async () => {
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await call('POST', `/api/offers/${ids.booking}/book`, { date: day, quantity: 1 }, 'acheteur');
  const s = await call('GET', '/api/pi/admin/summary', null, 'admin');
  assert.equal(s.data.held.amount, 5);
  assert.equal(s.data.owedToUsers, Math.round((s.data.userBalances + 5) * 1e7) / 1e7);
  const tasks = await call('GET', '/api/admin/tasks', null, 'admin');
  assert.equal(tasks.status, 200);
});
