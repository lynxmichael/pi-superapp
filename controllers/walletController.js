const User = require('../models/User');
const Payment = require('../models/Payment');

// Obtenir le solde
const getBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('balance totalEarned totalSpent');
    
    res.json({
      balance: user.balance,
      totalEarned: user.totalEarned,
      totalSpent: user.totalSpent
    });
  } catch (error) {
    console.error('Erreur récupération solde:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du solde' });
  }
};

// Obtenir les transactions
const getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    
    const filter = { user: req.user._id, status: 'completed' };
    
    if (type === 'income') {
      filter.toAddress = req.user.walletAddress;
    } else if (type === 'expense') {
      filter.fromAddress = req.user.walletAddress;
    }

    const transactions = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('serviceItem', 'name title');

    const total = await Payment.countDocuments(filter);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur récupération transactions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des transactions' });
  }
};

// Obtenir l'adresse du portefeuille
const getWalletAddress = async (req, res) => {
  try {
    res.json({ address: req.user.walletAddress });
  } catch (error) {
    console.error('Erreur récupération adresse:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'adresse' });
  }
};

// Transferer des fonds
const transferFunds = async (req, res) => {
  try {
    const { toAddress, amount, memo } = req.body;

    if (req.user.balance < amount) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }

    // Créer un paiement de transfert
    const payment = new Payment({
      paymentId: `transfer_${Date.now()}`,
      fromAddress: req.user.walletAddress,
      toAddress,
      amount,
      memo: memo || 'Transfert de fonds',
      serviceType: 'transfer',
      user: req.user._id,
      status: 'completed'
    });

    await payment.save();

    // Mettre à jour les soldes
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 
        balance: -amount,
        totalSpent: amount
      }
    });

    // Mettre à jour le destinataire (si dans notre système)
    const recipient = await User.findOne({ walletAddress: toAddress });
    if (recipient) {
      await User.findByIdAndUpdate(recipient._id, {
        $inc: { 
          balance: amount,
          totalEarned: amount
        }
      });
    }

    res.json({
      message: 'Transfert effectué avec succès',
      transaction: payment
    });
  } catch (error) {
    console.error('Erreur transfert:', error);
    res.status(500).json({ error: 'Erreur lors du transfert' });
  }
};

// Exporter les transactions
const exportTransactions = async (req, res) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;
    
    const filter = { 
      user: req.user._id,
      status: 'completed'
    };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .populate('serviceItem', 'name title');

    if (format === 'csv') {
      // Générer CSV
      const csv = generateCSV(transactions);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      return res.send(csv);
    }

    res.json({ transactions });
  } catch (error) {
    console.error('Erreur export transactions:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export des transactions' });
  }
};

// Obtenir les statistiques de gains
const getEarningStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const stats = await Payment.aggregate([
      {
        $match: {
          user: req.user._id,
          status: 'completed',
          toAddress: req.user.walletAddress,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalEarned: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      }
    ]);

    res.json({
      period,
      startDate,
      stats: stats[0] || { totalEarned: 0, transactionCount: 0, averageAmount: 0 }
    });
  } catch (error) {
    console.error('Erreur stats gains:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
};

// Fonction utilitaire pour générer CSV
const generateCSV = (transactions) => {
  const headers = ['Date', 'Type', 'Montant', 'Description', 'Statut'];
  let csv = headers.join(',') + '\n';

  transactions.forEach(transaction => {
    const row = [
      transaction.createdAt.toISOString(),
      transaction.serviceType,
      transaction.amount,
      transaction.memo,
      transaction.status
    ];
    csv += row.join(',') + '\n';
  });

  return csv;
};

module.exports = {
  getBalance,
  getTransactions,
  getWalletAddress,
  transferFunds,
  exportTransactions,
  getEarningStats
};