const { Subscription, UserSubscription } = require('../models/Subscription');

// Obtenir tous les abonnements disponibles
const getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ status: 'active' });

    res.json({ subscriptions });
  } catch (error) {
    console.error('Erreur récupération abonnements:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des abonnements' });
  }
};

// Souscrire à un abonnement
const subscribe = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const userId = req.user._id;

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || subscription.status !== 'active') {
      return res.status(404).json({ error: 'Abonnement non disponible' });
    }

    // Vérifier si l'utilisateur a déjà un abonnement actif
    const existingSubscription = await UserSubscription.findOne({
      user: userId,
      status: 'active'
    });

    if (existingSubscription) {
      return res.status(400).json({ error: 'Vous avez déjà un abonnement actif' });
    }

    // Calculer la date de fin
    const startDate = new Date();
    const endDate = new Date();
    switch (subscription.billingCycle) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'daily':
        endDate.setDate(endDate.getDate() + 1);
        break;
    }

    const userSubscription = new UserSubscription({
      user: userId,
      subscription: subscriptionId,
      startDate,
      endDate,
      nextBillingDate: endDate,
      status: 'pending' // En attente de paiement
    });

    await userSubscription.save();

    res.status(201).json({
      message: 'Abonnement créé avec succès. Veuillez effectuer le paiement.',
      userSubscription
    });
  } catch (error) {
    console.error('Erreur création abonnement:', error);
    res.status(500).json({ error: 'Erreur lors de la souscription à l\'abonnement' });
  }
};

// Obtenir les abonnements de l'utilisateur
const getUserSubscriptions = async (req, res) => {
  try {
    const userSubscriptions = await UserSubscription.find({ user: req.user._id })
      .populate('subscription')
      .sort({ createdAt: -1 });

    res.json({ userSubscriptions });
  } catch (error) {
    console.error('Erreur récupération abonnements utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de vos abonnements' });
  }
};

// Annuler un abonnement
const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    const userSubscription = await UserSubscription.findOne({
      _id: id,
      user: req.user._id,
      status: 'active'
    });

    if (!userSubscription) {
      return res.status(404).json({ error: 'Abonnement non trouvé ou non actif' });
    }

    userSubscription.status = 'cancelled';
    userSubscription.autoRenew = false;
    await userSubscription.save();

    res.json({ message: 'Abonnement annulé avec succès', userSubscription });
  } catch (error) {
    console.error('Erreur annulation abonnement:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation de l\'abonnement' });
  }
};

module.exports = {
  getSubscriptions,
  subscribe,
  getUserSubscriptions,
  cancelSubscription
};