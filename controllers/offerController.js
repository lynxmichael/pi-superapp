/**
 * Réservations et abonnements proposés par des commerçants VÉRIFIÉS (KYC approuvé).
 * - Réservation : les Pi du client sont bloqués jusqu'à ce que le commerçant accepte
 *   (il est alors payé) ou refuse (le client est remboursé).
 * - Abonnement : payé à l'avance pour une semaine, un mois ou un an ; chaque paiement prolonge.
 */
const mongoose = require('mongoose');
const Offer = require('../models/Offer');
const Booking = require('../models/Booking');
const Membership = require('../models/Membership');
const AppSetting = require('../models/AppSetting');
const ledger = require('../services/ledger');
const { handle, httpError, cleanText, cleanLongText, requireVerified } = require('../utils/http');
const { publicUrl } = require('../utils/uploads');

const CATEGORIES = ['hotel', 'restaurant', 'transport', 'event', 'sport', 'beauty', 'education', 'other'];
const PERIODS = { week: 'semaine', month: 'mois', year: 'an' };
const MAX_PRICE = 1000000;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function addPeriod(date, period) {
  const d = new Date(date);
  if (period === 'week') d.setDate(d.getDate() + 7);
  else if (period === 'month') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

function publicOffer(o) {
  return {
    id: o._id,
    kind: o.kind,
    category: o.category,
    title: o.title,
    description: o.description,
    city: o.city,
    image: o.image,
    price: o.price,
    unit: o.unit,
    period: o.period,
    status: o.status,
    merchant: o.merchantUsername,
    stats: o.stats,
    createdAt: o.createdAt
  };
}

function publicBooking(b, viewerId) {
  return {
    id: b._id,
    role: String(b.customer) === String(viewerId) ? 'customer' : 'merchant',
    offer: b.offer,
    offerTitle: b.offerTitle,
    unit: b.unit,
    merchant: b.merchantUsername,
    customer: b.customerUsername,
    date: b.date,
    quantity: b.quantity,
    unitPrice: b.unitPrice,
    total: b.total,
    merchantAmount: b.merchantAmount,
    note: b.note,
    status: b.status,
    refuseReason: b.refuseReason,
    createdAt: b.createdAt
  };
}

function publicMembership(m, viewerId) {
  return {
    id: m._id,
    role: String(m.customer) === String(viewerId) ? 'customer' : 'merchant',
    offer: m.offer,
    offerTitle: m.offerTitle,
    merchant: m.merchantUsername,
    customer: m.customerUsername,
    period: m.period,
    price: m.price,
    startDate: m.startDate,
    endDate: m.endDate,
    active: m.endDate > new Date(),
    payments: m.payments
  };
}

function readOfferFields(body, partial, kind) {
  const out = {};
  if (!partial || body.title !== undefined) {
    out.title = cleanText(body.title, 120);
    if (out.title.length < 3) throw httpError(400, 'Donnez un titre à l\'offre (3 caractères minimum).');
  }
  if (!partial || body.description !== undefined) {
    out.description = cleanLongText(body.description, 2000);
    if (out.description.length < 10) throw httpError(400, 'Décrivez l\'offre (10 caractères minimum).');
  }
  if (!partial || body.price !== undefined) {
    out.price = ledger.parseAmount(body.price);
    if (out.price === null || out.price > MAX_PRICE) throw httpError(400, 'Entrez un prix valide en π.');
  }
  if (!partial || body.category !== undefined) out.category = CATEGORIES.includes(body.category) ? body.category : 'other';
  if (!partial || body.city !== undefined) out.city = cleanText(body.city, 80);
  if (kind === 'booking' && (!partial || body.unit !== undefined)) out.unit = cleanText(body.unit, 30) || 'personne';
  if (kind === 'subscription' && (!partial || body.period !== undefined)) {
    if (!PERIODS[body.period]) throw httpError(400, 'Choisissez la durée : semaine, mois ou an.');
    out.period = body.period;
  }
  if (partial && body.status !== undefined) {
    if (!['active', 'inactive'].includes(body.status)) throw httpError(400, 'Statut invalide.');
    out.status = body.status;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Offres
// ---------------------------------------------------------------------------

const listOffers = handle(async (req, res) => {
  const filter = { status: 'active' };
  if (['booking', 'subscription'].includes(req.query.kind)) filter.kind = req.query.kind;
  if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  const q = cleanText(req.query.q, 60);
  if (q) filter.$or = [{ title: { $regex: escapeRegex(q), $options: 'i' } }, { city: { $regex: escapeRegex(q), $options: 'i' } }];
  const offers = await Offer.find(filter).sort({ createdAt: -1 }).limit(60);
  res.json({ offers: offers.map(publicOffer) });
});

const getOffer = handle(async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  const mine = !!(offer && req.user && String(offer.merchant) === String(req.user._id));
  if (!offer || offer.status === 'deleted' || (offer.status !== 'active' && !mine)) {
    throw httpError(404, 'Cette offre n\'est plus disponible.');
  }
  res.json({ offer: publicOffer(offer), mine });
});

const myOffers = handle(async (req, res) => {
  const offers = await Offer.find({ merchant: req.user._id, status: { $ne: 'deleted' } }).sort({ createdAt: -1 });
  res.json({ offers: offers.map(publicOffer) });
});

const createOffer = handle(async (req, res) => {
  requireVerified(req.user);
  const body = req.body || {};
  const kind = body.kind;
  if (!['booking', 'subscription'].includes(kind)) throw httpError(400, 'Choisissez : réservation ou abonnement.');
  const fields = readOfferFields(body, false, kind);
  const file = (req.files || [])[0];
  const offer = await Offer.create({
    ...fields,
    kind,
    image: file ? publicUrl(file) : undefined,
    merchant: req.user._id,
    merchantUsername: req.user.piUsername
  });
  res.status(201).json({ offer: publicOffer(offer) });
});

const updateOffer = handle(async (req, res) => {
  const offer = await Offer.findOne({ _id: req.params.id, merchant: req.user._id, status: { $ne: 'deleted' } });
  if (!offer) throw httpError(404, 'Offre introuvable.');
  Object.assign(offer, readOfferFields(req.body || {}, true, offer.kind));
  const file = (req.files || [])[0];
  if (file) offer.image = publicUrl(file);
  await offer.save();
  res.json({ offer: publicOffer(offer) });
});

const deleteOffer = handle(async (req, res) => {
  const result = await Offer.updateOne(
    { _id: req.params.id, merchant: req.user._id, status: { $ne: 'deleted' } },
    { $set: { status: 'deleted' } }
  );
  if (!result.matchedCount) throw httpError(404, 'Offre introuvable.');
  res.json({ ok: true });
});

async function activeOfferFor(req, kind) {
  const offer = await Offer.findOne({ _id: req.params.id, status: 'active', kind });
  if (!offer) throw httpError(404, 'Cette offre n\'est plus disponible.');
  if (String(offer.merchant) === String(req.user._id)) throw httpError(400, 'C\'est votre propre offre.');
  return offer;
}

// ---------------------------------------------------------------------------
// Réservations
// ---------------------------------------------------------------------------

function parseDay(raw) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw || ''))) return null;
  const d = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setUTCFullYear(max.getUTCFullYear() + 1);
  if (d < today || d > max) return null;
  return d;
}

const bookOffer = handle(async (req, res) => {
  const offer = await activeOfferFor(req, 'booking');
  const body = req.body || {};
  const date = parseDay(body.date);
  if (!date) throw httpError(400, 'Choisissez une date entre aujourd\'hui et dans un an.');
  const quantity = Number(body.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw httpError(400, 'Nombre invalide (1 à 50).');

  const settings = await AppSetting.current();
  const total = ledger.round7(offer.price * quantity);
  const id = new mongoose.Types.ObjectId();

  const { op } = await ledger.debit(req.user._id, total, {
    type: 'booking',
    status: 'held',
    label: `Réservation : ${offer.title}`,
    ref: { kind: 'booking', id }
  });

  try {
    const booking = await Booking.create({
      _id: id,
      offer: offer._id,
      offerTitle: offer.title,
      unit: offer.unit,
      merchant: offer.merchant,
      merchantUsername: offer.merchantUsername,
      customer: req.user._id,
      customerUsername: req.user.piUsername,
      date,
      quantity,
      unitPrice: offer.price,
      total,
      note: cleanLongText(body.note, 500),
      commissionPercent: settings.offersCommissionPercent || 0,
      op: op._id
    });
    res.status(201).json({ booking: publicBooking(booking, req.user._id) });
  } catch (error) {
    await ledger.refundHeld(op._id, 'Réservation annulée (erreur)');
    throw error;
  }
});

const listBookings = handle(async (req, res) => {
  const role = req.query.role === 'merchant' ? 'merchant' : 'customer';
  const bookings = await Booking.find({ [role]: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ bookings: bookings.map((b) => publicBooking(b, req.user._id)) });
});

const acceptBooking = handle(async (req, res) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, merchant: req.user._id, status: 'pending' },
    { $set: { status: 'confirmed', decidedAt: new Date() } },
    { new: true }
  );
  if (!booking) throw httpError(409, 'Cette réservation a déjà été traitée.');

  await ledger.settleHeld(booking.op);
  const fee = ledger.commission(booking.total, booking.commissionPercent);
  const net = ledger.round7(booking.total - fee);
  const income = await ledger.credit(booking.merchant, net, {
    type: 'income',
    label: `Réservation reçue : ${booking.offerTitle} (@${booking.customerUsername})`,
    ref: { kind: 'booking', id: booking._id }
  });
  booking.commission = fee;
  booking.merchantAmount = net;
  booking.incomeOp = income && income._id;
  await booking.save();
  await Offer.updateOne({ _id: booking.offer }, { $inc: { 'stats.bookings': 1 } });
  res.json({ booking: publicBooking(booking, req.user._id) });
});

async function closeBooking(req, who) {
  const reason = cleanText(req.body && req.body.reason, 300) ||
    (who === 'merchant' ? 'Refusée par le commerçant' : 'Annulée par le client');
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, [who]: req.user._id, status: 'pending' },
    { $set: { status: who === 'merchant' ? 'refused' : 'cancelled', refuseReason: reason, decidedAt: new Date() } },
    { new: true }
  );
  if (!booking) throw httpError(409, 'Cette réservation a déjà été traitée.');
  await ledger.refundHeld(booking.op, reason);
  return booking;
}

const refuseBooking = handle(async (req, res) => {
  const booking = await closeBooking(req, 'merchant');
  res.json({ booking: publicBooking(booking, req.user._id) });
});

const cancelBooking = handle(async (req, res) => {
  const booking = await closeBooking(req, 'customer');
  res.json({ booking: publicBooking(booking, req.user._id) });
});

// ---------------------------------------------------------------------------
// Abonnements
// ---------------------------------------------------------------------------

const subscribe = handle(async (req, res) => {
  const offer = await activeOfferFor(req, 'subscription');
  const settings = await AppSetting.current();
  const price = offer.price;

  const { op } = await ledger.debit(req.user._id, price, {
    type: 'subscription',
    status: 'held',
    label: `Abonnement : ${offer.title} (1 ${PERIODS[offer.period]})`,
    ref: { kind: 'membership', id: offer._id }
  });

  let membership = null;
  try {
    for (let attempt = 0; attempt < 5 && !membership; attempt += 1) {
      const now = new Date();
      const existing = await Membership.findOne({ offer: offer._id, customer: req.user._id });
      if (!existing) {
        try {
          membership = await Membership.create({
            offer: offer._id,
            offerTitle: offer.title,
            merchant: offer.merchant,
            merchantUsername: offer.merchantUsername,
            customer: req.user._id,
            customerUsername: req.user.piUsername,
            period: offer.period,
            price,
            startDate: now,
            endDate: addPeriod(now, offer.period),
            payments: 1,
            totalPaid: price
          });
        } catch (error) {
          if (error.code !== 11000) throw error; // créé en parallèle : on réessaie
        }
      } else {
        const base = existing.endDate > now ? existing.endDate : now;
        membership = await Membership.findOneAndUpdate(
          { _id: existing._id, endDate: existing.endDate },
          {
            $set: { endDate: addPeriod(base, offer.period), period: offer.period, price, offerTitle: offer.title },
            $inc: { payments: 1, totalPaid: price }
          },
          { new: true }
        );
      }
    }
    if (!membership) throw httpError(409, 'Réessayez dans un instant.');
  } catch (error) {
    await ledger.refundHeld(op._id, 'Abonnement annulé (erreur)');
    throw error;
  }

  await ledger.settleHeld(op._id);
  const fee = ledger.commission(price, settings.offersCommissionPercent);
  await ledger.credit(offer.merchant, ledger.round7(price - fee), {
    type: 'income',
    label: `Abonnement reçu : ${offer.title} (@${req.user.piUsername})`,
    ref: { kind: 'membership', id: membership._id }
  });
  await Offer.updateOne({ _id: offer._id }, { $inc: { 'stats.subscriptions': 1 } });

  res.status(201).json({ membership: publicMembership(membership, req.user._id) });
});

const listMemberships = handle(async (req, res) => {
  const role = req.query.role === 'merchant' ? 'merchant' : 'customer';
  const memberships = await Membership.find({ [role]: req.user._id }).sort({ endDate: -1 }).limit(200);
  res.json({ memberships: memberships.map((m) => publicMembership(m, req.user._id)) });
});

module.exports = {
  CATEGORIES,
  PERIODS,
  listOffers,
  getOffer,
  myOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  bookOffer,
  listBookings,
  acceptBooking,
  refuseBooking,
  cancelBooking,
  subscribe,
  listMemberships
};
