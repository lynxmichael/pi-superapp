const Recharge = require('../models/Recharge');
const Payment = require('../models/Payment');

// Créer une recharge
const createRecharge = async (req, res) => {
  try {
    const { type, provider, amount, recipient, metadata } = req.body;

    const recharge = new Recharge({
      user: req.user._id,
      type,
      provider,
      amount,
      recipient,
      metadata,
      status: 'pending'
    });

    await recharge.save();

    res.status(201).json({
      message: 'Recharge créée avec succès',
      recharge
    });
  } catch (error) {
    console.error('Erreur création recharge:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la recharge' });
  }
};

// Obtenir l'historique des recharges
const getRechargeHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status } = req.query;
    
    const filter = { user: req.user._id };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const recharges = await Recharge.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Recharge.countDocuments(filter);

    res.json({
      recharges,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur récupération recharges:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des recharges' });
  }
};

// Obtenir une recharge spécifique
const getRecharge = async (req, res) => {
  try {
    const { id } = req.params;

    const recharge = await Recharge.findOne({
      _id: id,
      user: req.user._id
    }).populate('payment');

    if (!recharge) {
      return res.status(404).json({ error: 'Recharge non trouvée' });
    }

    res.json({ recharge });
  } catch (error) {
    console.error('Erreur récupération recharge:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la recharge' });
  }
};

// Obtenir les opérateurs disponibles
const getProviders = async (req, res) => {
  try {
    const { type } = req.query;

    // Cette liste peut être stockée en base de données ou dans un fichier de configuration
    const providers = {
      mobile: ['Orange', 'Free Mobile', 'SFR', 'Bouygues Telecom'],
      electricity: ['EDF', 'TotalEnergies', 'Engie'],
      water: ['Veolia', 'Suez'],
      internet: ['Orange', 'Free', 'SFR', 'Bouygues Telecom'],
      tv: ['Canal+', 'Netflix', 'Amazon Prime']
    };

    const availableProviders = type ? providers[type] || [] : Object.values(providers).flat();

    res.json({ providers: availableProviders });
  } catch (error) {
    console.error('Erreur récupération opérateurs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des opérateurs' });
  }
};

module.exports = {
  createRecharge,
  getRechargeHistory,
  getRecharge,
  getProviders
};