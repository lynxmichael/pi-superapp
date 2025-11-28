const axios = require('axios');

class PiNetwork {
  constructor() {
    this.apiKey = process.env.PI_API_KEY;
    this.baseURL = 'https://api.minepi.com/v2';
    this.webhookSecret = process.env.PI_WEBHOOK_SECRET;
  }

  async createPayment(amount, memo, metadata = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/payments`, {
        amount: amount,
        memo: memo,
        metadata: metadata,
        uid: metadata.userId
      }, {
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Erreur création paiement Pi:', error.response?.data || error.message);
      throw new Error('Erreur lors de la création du paiement');
    }
  }

  async approvePayment(paymentId) {
    try {
      const response = await axios.post(`${this.baseURL}/payments/${paymentId}/approve`, {}, {
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Erreur approbation paiement:', error.response?.data || error.message);
      throw new Error('Erreur lors de l\'approbation du paiement');
    }
  }

  async completePayment(paymentId, txid) {
    try {
      const response = await axios.post(`${this.baseURL}/payments/${paymentId}/complete`, {
        txid: txid
      }, {
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Erreur complétion paiement:', error.response?.data || error.message);
      throw new Error('Erreur lors de la complétion du paiement');
    }
  }

  verifyWebhookSignature(payload, signature) {
    // Implémentation de la vérification de signature webhook
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

module.exports = new PiNetwork();