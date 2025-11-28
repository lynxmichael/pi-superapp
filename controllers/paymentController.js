const Payment = require('../models/Payment');
const User = require('../models/User');
const piNetwork = require('../config/pi');

// Créer un paiement
const createPayment = async (req, res) => {
  try {
    const { amount, memo, metadata, serviceType, serviceItem } = req.body;
    const userId = req.user._id;

    // Créer le paiement dans Pi Network
    const piPayment = await piNetwork.createPayment(amount, memo, {
      ...metadata,
      userId: userId.toString()
    });

    // Sauvegarder en base de données
    const payment = new Payment({
      paymentId: piPayment.identifier,
      fromAddress: req.user.walletAddress,
      toAddress: metadata.toAddress || process.env.PI_APP_WALLET,
      amount,
      memo,
      metadata,
      serviceType,
      serviceItem,
      user: userId,
      piNetworkData: piPayment
    });

    await payment.save();

    res.status(201).json({
      message: 'Paiement créé avec succès',
      payment: {
        id: payment._id,
        paymentId: payment.paymentId,
        amount: payment.amount,
        memo: payment.memo,
        status: payment.status
      },
      piPayment
    });
  } catch (error) {
    console.error('Erreur création paiement:', error);
    res.status(500).json({ error: 'Erreur lors de la création du paiement' });
  }
};

// Approuver un paiement
const approvePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findOne({ 
      paymentId,
      user: req.user._id 
    });

    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'Paiement déjà traité' });
    }

    // Approuver dans Pi Network
    await piNetwork.approvePayment(paymentId);

    // Mettre à jour le statut
    payment.status = 'approved';
    await payment.save();

    res.json({ 
      message: 'Paiement approuvé avec succès',
      payment 
    });
  } catch (error) {
    console.error('Erreur approbation paiement:', error);
    res.status(500).json({ error: 'Erreur lors de l\'approbation du paiement' });
  }
};

// Compléter un paiement
const completePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { txid } = req.body;

    const payment = await Payment.findOne({ 
      paymentId,
      user: req.user._id 
    });

    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    if (payment.status !== 'approved') {
      return res.status(400).json({ error: 'Paiement non approuvé' });
    }

    // Compléter dans Pi Network
    await piNetwork.completePayment(paymentId, txid);

    // Mettre à jour le statut et les soldes
    payment.status = 'completed';
    payment.txid = txid;

    // Mettre à jour le solde de l'utilisateur si c'est un revenu
    if (payment.serviceType === 'transfer' && payment.toAddress === req.user.walletAddress) {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { 
          balance: payment.amount,
          totalEarned: payment.amount
        }
      });
    }

    await payment.save();

    res.json({ 
      message: 'Paiement complété avec succès',
      payment 
    });
  } catch (error) {
    console.error('Erreur complétion paiement:', error);
    res.status(500).json({ error: 'Erreur lors de la complétion du paiement' });
  }
};

// Annuler un paiement
const cancelPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findOneAndUpdate(
      { 
        paymentId,
        user: req.user._id,
        status: 'pending'
      },
      { status: 'cancelled' },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé ou non annulable' });
    }

    res.json({ 
      message: 'Paiement annulé avec succès',
      payment 
    });
  } catch (error) {
    console.error('Erreur annulation paiement:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation du paiement' });
  }
};

// Obtenir l'historique des paiements
const getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, serviceType } = req.query;
    const filter = { user: req.user._id };

    if (serviceType) {
      filter.serviceType = serviceType;
    }

    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('serviceItem', 'name title');

    const total = await Payment.countDocuments(filter);

    res.json({
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur historique paiements:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
};

// Obtenir les détails d'un paiement
const getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findOne({
      $or: [
        { paymentId },
        { _id: paymentId }
      ],
      user: req.user._id
    }).populate('serviceItem');

    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    res.json({ payment });
  } catch (error) {
    console.error('Erreur détails paiement:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
};

module.exports = {
  createPayment,
  approvePayment,
  completePayment,
  cancelPayment,
  getPaymentHistory,
  getPaymentDetails
};