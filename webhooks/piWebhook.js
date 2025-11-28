const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const piNetwork = require('../config/pi');

// Webhook pour les paiements Pi Network
router.post('/payments', async (req, res) => {
  try {
    const { body, headers } = req;
    
    // Vérifier la signature du webhook
    const signature = headers['x-pi-signature'];
    if (!piNetwork.verifyWebhookSignature(body, signature)) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    const { identifier, amount, memo, metadata, from_address, status } = body;

    // Trouver le paiement correspondant
    const payment = await Payment.findOne({ paymentId: identifier });

    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé' });
    }

    // Mettre à jour le statut du paiement
    payment.status = status;
    payment.fromAddress = from_address;

    if (status === 'completed') {
      // Mettre à jour les soldes de l'utilisateur
      await User.findByIdAndUpdate(payment.user, {
        $inc: { 
          balance: -payment.amount,
          totalSpent: payment.amount,
          'stats.totalTransactions': 1
        }
      });

      // Traiter en fonction du type de service
      await processServicePayment(payment);
    }

    await payment.save();

    res.json({ message: 'Webhook traité avec succès' });
  } catch (error) {
    console.error('Erreur webhook:', error);
    res.status(500).json({ error: 'Erreur lors du traitement du webhook' });
  }
});

// Traiter le paiement selon le service
const processServicePayment = async (payment) => {
  try {
    switch (payment.serviceType) {
      case 'marketplace':
        // Marquer le produit comme vendu
        const Product = require('../models/Product');
        await Product.findByIdAndUpdate(payment.serviceItem, {
          $inc: { stock: -1, 'stats.sales': 1 }
        });
        break;

      case 'subscription':
        // Activer l'abonnement
        const { UserSubscription } = require('../models/Subscription');
        const subscription = await UserSubscription.findOne({
          user: payment.user,
          subscription: payment.serviceItem
        });
        
        if (subscription) {
          subscription.status = 'active';
          subscription.startDate = new Date();
          subscription.endDate = calculateEndDate(subscription.subscription.billingCycle);
          await subscription.save();
        }
        break;

      // Ajouter d'autres cas selon les services
    }
  } catch (error) {
    console.error('Erreur traitement paiement service:', error);
  }
};

// Calculer la date de fin d'abonnement
const calculateEndDate = (billingCycle) => {
  const endDate = new Date();
  
  switch (billingCycle) {
    case 'monthly':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case 'yearly':
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
    case 'weekly':
      endDate.setDate(endDate.getDate() + 7);
      break;
    default:
      endDate.setMonth(endDate.getMonth() + 1);
  }

  return endDate;
};

module.exports = router;