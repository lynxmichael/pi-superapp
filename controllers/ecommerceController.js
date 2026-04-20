const EcommerceOrder = require('../models/EcommerceOrder');
const Product = require('../models/Product');
const Payment = require('../models/Payment');

// Créer une commande
const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, notes } = req.body;
    const userId = req.user._id;

    // Calculer le total et vérifier les produits
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findOne({
        _id: item.product,
        status: 'active',
        stock: { $gte: item.quantity }
      });

      if (!product) {
        return res.status(400).json({
          error: `Produit non disponible: ${item.product}`
        });
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal
      });
    }

    // Créer la commande
    const order = new EcommerceOrder({
      orderId: `ORD${Date.now()}`,
      user: userId,
      items: orderItems,
      totalAmount,
      shippingAddress,
      notes,
      status: 'pending'
    });

    await order.save();

    res.status(201).json({
      message: 'Commande créée avec succès',
      order
    });
  } catch (error) {
    console.error('Erreur création commande:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la commande' });
  }
};

// Obtenir les commandes de l'utilisateur
const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const orders = await EcommerceOrder.find(filter)
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await EcommerceOrder.countDocuments(filter);

    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur récupération commandes:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
};

// Obtenir une commande spécifique
const getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await EcommerceOrder.findOne({
      _id: id,
      user: req.user._id
    }).populate('items.product', 'name images description')
      .populate('payment');

    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Erreur récupération commande:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
};

// Annuler une commande
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await EcommerceOrder.findOne({
      _id: id,
      user: req.user._id,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée ou non annulable' });
    }

    order.status = 'cancelled';
    await order.save();

    // Recréditer le stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    res.json({ message: 'Commande annulée avec succès', order });
  } catch (error) {
    console.error('Erreur annulation commande:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation de la commande' });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrder,
  cancelOrder
};