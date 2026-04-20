const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const User = require('../models/User');

// Créer une nouvelle transaction
const createTransaction = async (req, res) => {
  try {
    const { type, amount, toAddress, memo, metadata } = req.body;
    const userId = req.user._id;

    // Validation
    if (!type || !amount || !toAddress) {
      return res.status(400).json({
        error: 'Type, montant et adresse de destination sont requis'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: 'Le montant doit être supérieur à 0'
      });
    }

    // Récupérer le portefeuille de l'utilisateur
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(404).json({ error: 'Portefeuille non trouvé' });
    }

    // Vérifier le solde pour les envois
    if (type === 'send' && !wallet.hasSufficientBalance(amount)) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }

    // Créer la transaction
    const transaction = new Transaction({
      transactionId: Transaction.generateTransactionId(),
      user: userId,
      type,
      amount,
      currency: 'PI',
      fromAddress: wallet.address,
      toAddress,
      memo,
      metadata: metadata || {},
      status: 'pending',
      fee: type === 'send' ? 0.01 : 0, // Frais de transaction
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // Expire dans 30 minutes
    });

    // Pour les envois, bloquer les fonds
    if (type === 'send') {
      await wallet.lockFunds(amount + transaction.fee);
      await wallet.save();
    }

    await transaction.save();

    res.status(201).json({
      message: 'Transaction créée avec succès',
      transaction: {
        id: transaction._id,
        transactionId: transaction.transactionId,
        type: transaction.type,
        amount: transaction.amount,
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        status: transaction.status,
        memo: transaction.memo,
        fee: transaction.fee,
        expiresAt: transaction.expiresAt
      }
    });
  } catch (error) {
    console.error('Erreur création transaction:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création de la transaction',
      details: error.message 
    });
  }
};

// Obtenir l'historique des transactions
const getTransactionHistory = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      status,
      startDate, 
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { user: req.user._id };

    // Filtres
    if (type) filter.type = type;
    if (status) filter.status = status;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const transactions = await Transaction.find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Transaction.countDocuments(filter);
    const totalPages = Math.ceil(total / parseInt(limit));

    // Calculer les statistiques
    const stats = await Transaction.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: null,
          totalSent: { 
            $sum: { 
              $cond: [{ $eq: ['$type', 'send'] }, '$amount', 0] 
            }
          },
          totalReceived: { 
            $sum: { 
              $cond: [{ $eq: ['$type', 'receive'] }, '$amount', 0] 
            }
          },
          totalFees: { $sum: '$fee' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      }
    ]);

    res.json({
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      stats: stats[0] || {
        totalSent: 0,
        totalReceived: 0,
        totalFees: 0,
        transactionCount: 0,
        averageAmount: 0
      }
    });
  } catch (error) {
    console.error('Erreur récupération historique:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
};

// Obtenir une transaction spécifique
const getTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findOne({
      $or: [
        { _id: id },
        { transactionId: id }
      ],
      user: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }

    // Récupérer les détails du destinataire si c'est un utilisateur de notre système
    let recipientInfo = null;
    if (transaction.toAddress) {
      const recipientWallet = await Wallet.findOne({ 
        address: transaction.toAddress 
      });
      
      if (recipientWallet) {
        const recipientUser = await User.findById(recipientWallet.user)
          .select('piUsername profile.avatar');
        
        if (recipientUser) {
          recipientInfo = {
            username: recipientUser.piUsername,
            avatar: recipientUser.profile?.avatar
          };
        }
      }
    }

    res.json({
      transaction,
      recipientInfo
    });
  } catch (error) {
    console.error('Erreur récupération transaction:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la transaction' });
  }
};

// Annuler une transaction
const cancelTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findOne({
      $or: [
        { _id: id },
        { transactionId: id }
      ],
      user: req.user._id,
      status: 'pending'
    });

    if (!transaction) {
      return res.status(404).json({ 
        error: 'Transaction non trouvée ou non annulable' 
      });
    }

    // Débloquer les fonds si c'était un envoi
    if (transaction.type === 'send') {
      const wallet = await Wallet.findOne({ user: req.user._id });
      if (wallet) {
        await wallet.unlockFunds(transaction.amount + transaction.fee);
        await wallet.save();
      }
    }

    transaction.status = 'cancelled';
    await transaction.save();

    res.json({ 
      message: 'Transaction annulée avec succès',
      transaction 
    });
  } catch (error) {
    console.error('Erreur annulation transaction:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation de la transaction' });
  }
};

// Vérifier le statut d'une transaction
const checkTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findOne({
      $or: [
        { _id: id },
        { transactionId: id }
      ],
      user: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }

    // Vérifier si la transaction a expiré
    if (transaction.status === 'pending' && transaction.isExpired()) {
      transaction.status = 'failed';
      await transaction.save();

      // Débloquer les fonds si c'était un envoi
      if (transaction.type === 'send') {
        const wallet = await Wallet.findOne({ user: req.user._id });
        if (wallet) {
          await wallet.unlockFunds(transaction.amount + transaction.fee);
          await wallet.save();
        }
      }
    }

    res.json({ 
      status: transaction.status,
      transaction 
    });
  } catch (error) {
    console.error('Erreur vérification statut:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du statut' });
  }
};

// Exporter les transactions
const exportTransactions = async (req, res) => {
  try {
    const { format = 'csv', startDate, endDate } = req.query;

    const filter = { user: req.user._id };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      // Générer CSV
      const csv = generateCSV(transactions);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.csv`);
      return res.send(csv);
    } else if (format === 'json') {
      res.json({ transactions });
    } else if (format === 'pdf') {
      // Générer PDF (implémentation basique)
      const pdf = generatePDF(transactions);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.pdf`);
      return res.send(pdf);
    } else {
      res.status(400).json({ error: 'Format non supporté' });
    }
  } catch (error) {
    console.error('Erreur export transactions:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export des transactions' });
  }
};

// Générer CSV
const generateCSV = (transactions) => {
  const headers = ['Date', 'ID', 'Type', 'De', 'À', 'Montant', 'Frais', 'Statut', 'Description'];
  let csv = headers.join(';') + '\n';

  transactions.forEach(transaction => {
    const row = [
      transaction.createdAt.toISOString(),
      transaction.transactionId,
      transaction.type,
      transaction.fromAddress,
      transaction.toAddress,
      transaction.amount,
      transaction.fee,
      transaction.status,
      transaction.memo || ''
    ];
    csv += row.join(';') + '\n';
  });

  return csv;
};

// Générer PDF (simulation)
const generatePDF = (transactions) => {
  // Dans une implémentation réelle, utiliser une librairie comme pdfkit
  return Buffer.from('PDF simulation - utiliser pdfkit pour une implémentation réelle');
};

module.exports = {
  createTransaction,
  getTransactionHistory,
  getTransaction,
  cancelTransaction,
  checkTransactionStatus,
  exportTransactions
};