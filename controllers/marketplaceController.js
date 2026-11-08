/**
 * Marketplace : les vendeurs vérifiés (KYC) publient des produits, les acheteurs paient
 * avec leur solde. Les Pi restent BLOQUÉS jusqu'à ce que l'acheteur confirme la réception ;
 * en cas de litige, l'admin décide (rembourser l'acheteur ou payer le vendeur).
 */
const mongoose = require('mongoose');
const Product = require('../models/Product');
const MarketOrder = require('../models/MarketOrder');
const AppSetting = require('../models/AppSetting');
const ledger = require('../services/ledger');
const { handle, httpError, cleanText, cleanLongText, requireVerified } = require('../utils/http');
const { publicUrl } = require('../utils/uploads');

const CATEGORIES = ['electronics', 'fashion', 'home', 'sports', 'books', 'digital', 'services', 'other'];
const CONDITIONS = ['new', 'used', 'refurbished'];
const PAGE_SIZE = 20;
const MAX_PRICE = 1000000;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function intBetween(raw, min, max) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function publicProduct(p) {
  return {
    id: p._id,
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    category: p.category,
    condition: p.condition,
    city: p.city,
    status: p.status,
    images: (p.images || []).map((i) => i.url),
    seller: p.seller && p.seller.piUsername
      ? { id: p.seller._id, piUsername: p.seller.piUsername }
      : { id: p.seller },
    sales: (p.stats && p.stats.sales) || 0,
    createdAt: p.createdAt
  };
}

function publicOrder(o, viewerId) {
  return {
    id: o._id,
    role: String(o.buyer) === String(viewerId) ? 'buyer' : 'seller',
    buyer: o.buyerUsername,
    seller: o.sellerUsername,
    product: o.product,
    productName: o.productName,
    productImage: o.productImage,
    unitPrice: o.unitPrice,
    quantity: o.quantity,
    total: o.total,
    commission: o.commission,
    sellerAmount: o.sellerAmount,
    deliveryNote: o.deliveryNote,
    shippingNote: o.shippingNote,
    status: o.status,
    cancelReason: o.cancelReason,
    cancelledBy: o.cancelledBy,
    disputeReason: o.disputeReason,
    resolution: o.resolution,
    createdAt: o.createdAt,
    shippedAt: o.shippedAt,
    completedAt: o.completedAt
  };
}

/** Lit et vérifie les champs d'un produit (création ou modification). */
function readProductFields(body, partial) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = cleanText(body.name, 120);
    if (out.name.length < 2) throw httpError(400, 'Donnez un nom au produit (2 caractères minimum).');
  }
  if (!partial || body.description !== undefined) {
    out.description = cleanLongText(body.description, 2000);
    if (out.description.length < 5) throw httpError(400, 'Décrivez le produit (5 caractères minimum).');
  }
  if (!partial || body.price !== undefined) {
    out.price = ledger.parseAmount(body.price);
    if (out.price === null || out.price > MAX_PRICE) throw httpError(400, 'Entrez un prix valide en π.');
  }
  if (!partial || body.stock !== undefined) {
    out.stock = intBetween(body.stock === undefined || body.stock === '' ? 1 : body.stock, 0, 10000);
    if (out.stock === null) throw httpError(400, 'La quantité disponible doit être un nombre entier.');
  }
  if (!partial || body.category !== undefined) {
    out.category = CATEGORIES.includes(body.category) ? body.category : 'other';
  }
  if (!partial || body.condition !== undefined) {
    out.condition = CONDITIONS.includes(body.condition) ? body.condition : 'new';
  }
  if (!partial || body.city !== undefined) out.city = cleanText(body.city, 80);
  if (partial && body.status !== undefined) {
    if (!['active', 'inactive'].includes(body.status)) throw httpError(400, 'Statut invalide.');
    out.status = body.status;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------

const listProducts = handle(async (req, res) => {
  const page = intBetween(req.query.page || 1, 1, 1000) || 1;
  const filter = { status: 'active', stock: { $gt: 0 } };
  const q = cleanText(req.query.q, 60);
  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };
  if (CATEGORIES.includes(req.query.category)) filter.category = req.query.category;

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
      .populate('seller', 'piUsername'),
    Product.countDocuments(filter)
  ]);
  res.json({ products: products.map(publicProduct), page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total });
});

const getProduct = handle(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('seller', 'piUsername');
  const sellerId = product && product.seller && (product.seller._id || product.seller);
  const mine = !!(sellerId && req.user && String(sellerId) === String(req.user._id));
  if (!product || product.status === 'deleted' || (product.status !== 'active' && !mine)) {
    throw httpError(404, 'Ce produit n\'est plus disponible.');
  }
  res.json({ product: publicProduct(product), mine });
});

const myProducts = handle(async (req, res) => {
  const products = await Product.find({ seller: req.user._id, status: { $ne: 'deleted' } }).sort({ createdAt: -1 });
  res.json({ products: products.map(publicProduct) });
});

const createProduct = handle(async (req, res) => {
  requireVerified(req.user);
  const fields = readProductFields(req.body || {}, false);
  const images = (req.files || []).map((f, i) => ({ url: publicUrl(f), isPrimary: i === 0 }));
  const product = await Product.create({ ...fields, images, seller: req.user._id, status: 'active' });
  res.status(201).json({ product: publicProduct(product) });
});

const updateProduct = handle(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, seller: req.user._id, status: { $ne: 'deleted' } });
  if (!product) throw httpError(404, 'Produit introuvable.');
  Object.assign(product, readProductFields(req.body || {}, true));
  if (req.files && req.files.length) {
    product.images = req.files.map((f, i) => ({ url: publicUrl(f), isPrimary: i === 0 }));
  }
  await product.save();
  res.json({ product: publicProduct(product) });
});

const deleteProduct = handle(async (req, res) => {
  const result = await Product.updateOne(
    { _id: req.params.id, seller: req.user._id, status: { $ne: 'deleted' } },
    { $set: { status: 'deleted' } }
  );
  if (!result.matchedCount) throw httpError(404, 'Produit introuvable.');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Achat et suivi des commandes
// ---------------------------------------------------------------------------

const buyProduct = handle(async (req, res) => {
  const quantity = intBetween((req.body && req.body.quantity) || 1, 1, 100);
  if (!quantity) throw httpError(400, 'Quantité invalide.');
  const deliveryNote = cleanLongText(req.body && req.body.deliveryNote, 500);
  if (deliveryNote.length < 5) {
    throw httpError(400, 'Indiquez où et comment recevoir le produit (adresse, téléphone...).');
  }

  // Réserve le stock d'abord (atomique)
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, status: 'active', stock: { $gte: quantity }, seller: { $ne: req.user._id } },
    { $inc: { stock: -quantity } },
    { new: true }
  ).populate('seller', 'piUsername');

  if (!product) {
    const existing = await Product.findById(req.params.id);
    if (existing && String(existing.seller) === String(req.user._id)) {
      throw httpError(400, 'Vous ne pouvez pas acheter votre propre produit.');
    }
    throw httpError(400, 'Stock insuffisant ou produit indisponible.');
  }

  const restock = () => Product.updateOne({ _id: product._id }, { $inc: { stock: quantity } });
  const settings = await AppSetting.current();
  const total = ledger.round7(product.price * quantity);
  const orderId = new mongoose.Types.ObjectId();

  let op;
  try {
    ({ op } = await ledger.debit(req.user._id, total, {
      type: 'purchase',
      status: 'held',
      label: `Achat : ${product.name}`,
      ref: { kind: 'order', id: orderId }
    }));
  } catch (error) {
    await restock();
    throw error;
  }

  try {
    const order = await MarketOrder.create({
      _id: orderId,
      buyer: req.user._id,
      seller: product.seller._id,
      buyerUsername: req.user.piUsername,
      sellerUsername: product.seller.piUsername,
      product: product._id,
      productName: product.name,
      productImage: product.images && product.images[0] ? product.images[0].url : undefined,
      unitPrice: product.price,
      quantity,
      total,
      commissionPercent: settings.marketCommissionPercent || 0,
      deliveryNote,
      status: 'paid',
      buyerOp: op._id
    });
    res.status(201).json({ order: publicOrder(order, req.user._id) });
  } catch (error) {
    await ledger.refundHeld(op._id, 'Commande annulée (erreur)');
    await restock();
    throw error;
  }
});

const listOrders = handle(async (req, res) => {
  const role = req.query.role === 'seller' ? 'seller' : 'buyer';
  const orders = await MarketOrder.find({ [role]: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ orders: orders.map((o) => publicOrder(o, req.user._id)) });
});

/** Change le statut seulement si la commande est dans un des statuts attendus (une seule fois). */
async function transition(filter, fromStatuses, set) {
  return MarketOrder.findOneAndUpdate(
    { ...filter, status: { $in: fromStatuses } },
    { $set: set },
    { new: true }
  );
}

/** Paie le vendeur (moins la commission) : appelé après le passage à "completed". */
async function releaseToSeller(order) {
  await ledger.settleHeld(order.buyerOp);
  const fee = ledger.commission(order.total, order.commissionPercent);
  const net = ledger.round7(order.total - fee);
  const op = await ledger.credit(order.seller, net, {
    type: 'sale',
    label: `Vente : ${order.productName}`,
    ref: { kind: 'order', id: order._id }
  });
  await MarketOrder.updateOne({ _id: order._id }, { $set: { commission: fee, sellerAmount: net, saleOp: op && op._id } });
  await Product.updateOne({ _id: order.product }, { $inc: { 'stats.sales': order.quantity } });
  order.commission = fee;
  order.sellerAmount = net;
}

/** Rend les Pi à l'acheteur et remet le produit en stock : appelé après le passage à "cancelled". */
async function refundBuyer(order, reason) {
  await ledger.refundHeld(order.buyerOp, reason);
  await Product.updateOne({ _id: order.product, status: { $ne: 'deleted' } }, { $inc: { stock: order.quantity } });
}

const shipOrder = handle(async (req, res) => {
  const order = await transition({ _id: req.params.id, seller: req.user._id }, ['paid'], {
    status: 'shipped',
    shippedAt: new Date(),
    shippingNote: cleanText(req.body && req.body.note, 300)
  });
  if (!order) throw httpError(409, 'Cette commande ne peut pas être marquée comme envoyée.');
  res.json({ order: publicOrder(order, req.user._id) });
});

const confirmOrder = handle(async (req, res) => {
  const order = await transition({ _id: req.params.id, buyer: req.user._id }, ['paid', 'shipped'], {
    status: 'completed',
    completedAt: new Date()
  });
  if (!order) throw httpError(409, 'Cette commande ne peut pas être confirmée.');
  await releaseToSeller(order);
  res.json({ order: publicOrder(order, req.user._id) });
});

const cancelOrder = handle(async (req, res) => {
  const reason = cleanText(req.body && req.body.reason, 300) || 'Commande annulée';
  const current = await MarketOrder.findById(req.params.id);
  if (!current) throw httpError(404, 'Commande introuvable.');

  const isBuyer = String(current.buyer) === String(req.user._id);
  const isSeller = String(current.seller) === String(req.user._id);
  if (!isBuyer && !isSeller) throw httpError(404, 'Commande introuvable.');

  // L'acheteur peut annuler tant que rien n'est envoyé ; le vendeur jusqu'à la confirmation
  const allowed = isSeller ? ['paid', 'shipped'] : ['paid'];
  const order = await transition({ _id: current._id }, allowed, {
    status: 'cancelled',
    cancelledAt: new Date(),
    cancelReason: reason,
    cancelledBy: isSeller ? 'seller' : 'buyer'
  });
  if (!order) {
    throw httpError(409, isBuyer && current.status === 'shipped'
      ? 'Le produit est déjà envoyé : ouvrez un litige si vous ne l\'avez pas reçu.'
      : 'Cette commande ne peut plus être annulée.');
  }
  await refundBuyer(order, reason);
  res.json({ order: publicOrder(order, req.user._id) });
});

const disputeOrder = handle(async (req, res) => {
  const reason = cleanText(req.body && req.body.reason, 300);
  if (reason.length < 5) throw httpError(400, 'Expliquez le problème en quelques mots.');
  const order = await transition({ _id: req.params.id, buyer: req.user._id }, ['paid', 'shipped'], {
    status: 'disputed',
    disputedAt: new Date(),
    disputeReason: reason
  });
  if (!order) throw httpError(409, 'Un litige ne peut pas être ouvert pour cette commande.');
  res.json({ order: publicOrder(order, req.user._id) });
});

// ---------------------------------------------------------------------------
// Admin : litiges
// ---------------------------------------------------------------------------

const adminListDisputes = handle(async (req, res) => {
  const status = req.query.status === 'all' ? { $in: ['disputed', 'completed', 'cancelled'] } : 'disputed';
  const filter = { status };
  if (req.query.status === 'all') filter.disputedAt = { $exists: true };
  const orders = await MarketOrder.find(filter).sort({ disputedAt: 1 }).limit(200);
  res.json({ orders: orders.map((o) => ({ ...publicOrder(o, null), disputedAt: o.disputedAt })) });
});

const adminResolveDispute = handle(async (req, res) => {
  const decision = req.body && req.body.decision;
  if (!['refund', 'release'].includes(decision)) throw httpError(400, 'Décision invalide.');
  const note = cleanText(req.body && req.body.note, 300);

  const set = decision === 'release'
    ? { status: 'completed', completedAt: new Date(), resolution: 'release', resolvedBy: req.user._id }
    : {
        status: 'cancelled', cancelledAt: new Date(), resolution: 'refund', resolvedBy: req.user._id,
        cancelledBy: 'admin', cancelReason: note || 'Litige : remboursé par l\'admin'
      };
  const order = await transition({ _id: req.params.id }, ['disputed'], set);
  if (!order) throw httpError(409, 'Ce litige a déjà été traité.');

  if (decision === 'release') await releaseToSeller(order);
  else await refundBuyer(order, order.cancelReason);

  res.json({ order: publicOrder(order, null) });
});

module.exports = {
  CATEGORIES,
  listProducts,
  getProduct,
  myProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  buyProduct,
  listOrders,
  shipOrder,
  confirmOrder,
  cancelOrder,
  disputeOrder,
  adminListDisputes,
  adminResolveDispute
};
