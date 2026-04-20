const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

class WalletService {
  // Transférer des fonds entre portefeuilles
  static async transferFunds(senderUserId, recipientAddress, amount, memo = '') {
    try {
      // Récupérer le portefeuille de l'expéditeur
      const senderWallet = await Wallet.findOne({ user: senderUserId });
      if (!senderWallet) {
        throw new Error('Portefeuille expéditeur non trouvé');
      }

      // Vérifier le solde
      if (!senderWallet.hasSufficientBalance(amount)) {
        throw new Error('Solde insuffisant');
      }

      // Calculer les frais
      const fee = this.calculateFee(amount);
      const totalAmount = amount + fee;

      // Bloquer les fonds
      await senderWallet.lockFunds(totalAmount);
      await senderWallet.save();

      // Créer la transaction
      const transaction = new Transaction({
        transactionId: Transaction.generateTransactionId(),
        user: senderUserId,
        type: 'send',
        amount,
        fromAddress: senderWallet.address,
        toAddress: recipientAddress,
        memo,
        fee,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      });

      await transaction.save();

      // Vérifier si le destinataire est dans notre système
      const recipientWallet = await Wallet.findOne({ address: recipientAddress });
      if (recipientWallet) {
        // Créer une transaction de réception pour le destinataire
        const recipientTransaction = new Transaction({
          transactionId: Transaction.generateTransactionId(),
          user: recipientWallet.user,
          type: 'receive',
          amount,
          fromAddress: senderWallet.address,
          toAddress: recipientAddress,
          memo,
          fee: 0,
          status: 'pending'
        });

        await recipientTransaction.save();
      }

      return {
        success: true,
        transaction: {
          id: transaction._id,
          transactionId: transaction.transactionId,
          amount,
          fee,
          totalAmount,
          recipientAddress,
          expiresAt: transaction.expiresAt
        }
      };

    } catch (error) {
      console.error('Erreur transfert:', error);
      throw error;
    }
  }

  // Compléter une transaction
  static async completeTransaction(transactionId, txid = null) {
    try {
      const transaction = await Transaction.findOne({
        $or: [
          { _id: transactionId },
          { transactionId: transactionId }
        ]
      });

      if (!transaction) {
        throw new Error('Transaction non trouvée');
      }

      if (transaction.status !== 'pending') {
        throw new Error('Transaction déjà traitée');
      }

      // Mettre à jour le statut
      transaction.status = 'completed';
      transaction.confirmedAt = new Date();
      if (txid) transaction.txid = txid;

      // Mettre à jour les portefeuilles
      const senderWallet = await Wallet.findOne({ 
        address: transaction.fromAddress 
      });

      if (senderWallet) {
        // Débloquer les fonds et débiter
        await senderWallet.unlockFunds(transaction.amount + transaction.fee);
        await senderWallet.debit(transaction.amount + transaction.fee);
        await senderWallet.save();
      }

      // Créditer le destinataire s'il est dans notre système
      const recipientWallet = await Wallet.findOne({ 
        address: transaction.toAddress 
      });

      if (recipientWallet) {
        await recipientWallet.credit(transaction.amount);
        await recipientWallet.save();

        // Mettre à jour la transaction du destinataire
        const recipientTransaction = await Transaction.findOne({
          toAddress: transaction.toAddress,
          fromAddress: transaction.fromAddress,
          amount: transaction.amount,
          status: 'pending',
          type: 'receive'
        });

        if (recipientTransaction) {
          recipientTransaction.status = 'completed';
          recipientTransaction.confirmedAt = new Date();
          if (txid) recipientTransaction.txid = txid;
          await recipientTransaction.save();
        }
      }

      await transaction.save();

      return {
        success: true,
        transaction
      };

    } catch (error) {
      console.error('Erreur complétion transaction:', error);
      throw error;
    }
  }

  // Annuler une transaction
  static async cancelTransaction(transactionId) {
    try {
      const transaction = await Transaction.findOne({
        $or: [
          { _id: transactionId },
          { transactionId: transactionId }
        ]
      });

      if (!transaction) {
        throw new Error('Transaction non trouvée');
      }

      if (transaction.status !== 'pending') {
        throw new Error('Transaction non annulable');
      }

      // Débloquer les fonds
      if (transaction.type === 'send') {
        const senderWallet = await Wallet.findOne({ 
          address: transaction.fromAddress 
        });

        if (senderWallet) {
          await senderWallet.unlockFunds(transaction.amount + transaction.fee);
          await senderWallet.save();
        }
      }

      // Annuler la transaction
      transaction.status = 'cancelled';
      await transaction.save();

      return {
        success: true,
        transaction
      };

    } catch (error) {
      console.error('Erreur annulation transaction:', error);
      throw error;
    }
  }

  // Calculer les frais de transaction
  static calculateFee(amount) {
    // Frais fixes de 0.01 Pi pour l'exemple
    // Dans une implémentation réelle, cela pourrait être un pourcentage
    return 0.01;
  }

  // Vérifier si une adresse est valide
  static isValidAddress(address) {
    // Validation basique des adresses Pi
    return address && 
           address.startsWith('G') && 
           address.length >= 56 && 
           address.length <= 56;
  }

  // Obtenir le solde disponible
  static async getAvailableBalance(userId) {
    try {
      const wallet = await Wallet.findOne({ user: userId });
      if (!wallet) return 0;
      return wallet.getAvailableBalance();
    } catch (error) {
      console.error('Erreur récupération solde:', error);
      return 0;
    }
  }

  // Obtenir le résumé du portefeuille
  static async getWalletSummary(userId) {
    try {
      const wallet = await Wallet.findOne({ user: userId });
      if (!wallet) return null;

      // Statistiques des 30 derniers jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentTransactions = await Transaction.countDocuments({
        user: userId,
        createdAt: { $gte: thirtyDaysAgo },
        status: 'completed'
      });

      const recentVolume = await Transaction.aggregate([
        {
          $match: {
            user: userId,
            createdAt: { $gte: thirtyDaysAgo },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      return {
        address: wallet.address,
        balance: wallet.balance,
        availableBalance: wallet.getAvailableBalance(),
        lockedBalance: wallet.lockedBalance,
        totalSent: wallet.totalSent,
        totalReceived: wallet.totalReceived,
        transactionCount: wallet.transactionCount,
        recentTransactions,
        recentVolume: recentVolume[0]?.total || 0,
        settings: wallet.settings,
        lastTransaction: wallet.stats.lastTransaction
      };
    } catch (error) {
      console.error('Erreur récupération résumé:', error);
      throw error;
    }
  }
}

module.exports = WalletService;