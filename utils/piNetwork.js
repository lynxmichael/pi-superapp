const piNetwork = require('../config/pi');

// Fonctions utilitaires pour Pi Network
class PiNetworkUtils {
  // Convertir un montant en unités Pi (1 Pi = 1000000 unités)
  static toPiUnits(amount) {
    return Math.floor(amount * 1000000);
  }

  // Convertir des unités Pi en montant
  static fromPiUnits(units) {
    return units / 1000000;
  }

  // Valider une adresse Pi
  static isValidPiAddress(address) {
    // Implémentation basique - à adapter selon les spécifications Pi Network
    return address && address.length > 0 && address.startsWith('G');
  }

  // Créer un paiement avec gestion d'erreur
  static async createPayment(amount, memo, metadata = {}) {
    try {
      return await piNetwork.createPayment(amount, memo, metadata);
    } catch (error) {
      console.error('Erreur création paiement Pi:', error);
      throw new Error('Impossible de créer le paiement Pi');
    }
  }
}

module.exports = PiNetworkUtils;