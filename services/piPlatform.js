/**
 * Client de l'API Pi Platform (https://api.minepi.com/v2).
 *
 * - Dépôts (utilisateur -> app, "U2A") : le paiement est créé par le SDK Pi
 *   dans le Pi Browser ; le serveur vérifie puis approuve et complète.
 * - Retraits (app -> utilisateur, "A2U") : le serveur crée, signe et envoie
 *   le paiement avec le paquet officiel `pi-backend` (clé API + seed du wallet
 *   de l'app). Ne JAMAIS exposer ces valeurs au navigateur.
 */
const axios = require('axios');

const API_BASE = process.env.PI_API_BASE || 'https://api.minepi.com/v2';

const http = axios.create({ baseURL: API_BASE, timeout: 20000 });

function serverHeaders() {
  if (!process.env.PI_API_KEY) {
    throw new Error('PI_API_KEY manquant dans .env');
  }
  return { Authorization: `Key ${process.env.PI_API_KEY}` };
}

function piError(error, fallback) {
  const data = error.response && error.response.data;
  const detail = data && (data.error_message || data.message || data.error);
  const err = new Error(detail ? `${fallback} : ${detail}` : fallback);
  err.status = error.response ? error.response.status : undefined;
  return err;
}

/** Vérifie le jeton d'accès d'un utilisateur et renvoie { uid, username }. */
async function getMe(accessToken) {
  try {
    const { data } = await http.get('/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return data;
  } catch (error) {
    throw piError(error, 'Connexion Pi refusée');
  }
}

async function getPayment(paymentId) {
  try {
    const { data } = await http.get(`/payments/${encodeURIComponent(paymentId)}`, { headers: serverHeaders() });
    return data;
  } catch (error) {
    throw piError(error, 'Paiement Pi introuvable');
  }
}

async function approvePayment(paymentId) {
  try {
    const { data } = await http.post(`/payments/${encodeURIComponent(paymentId)}/approve`, {}, { headers: serverHeaders() });
    return data;
  } catch (error) {
    throw piError(error, "Impossible d'approuver le paiement Pi");
  }
}

async function completePayment(paymentId, txid) {
  try {
    const { data } = await http.post(`/payments/${encodeURIComponent(paymentId)}/complete`, { txid }, { headers: serverHeaders() });
    return data;
  } catch (error) {
    throw piError(error, 'Impossible de finaliser le paiement Pi');
  }
}

async function cancelPayment(paymentId) {
  try {
    const { data } = await http.post(`/payments/${encodeURIComponent(paymentId)}/cancel`, {}, { headers: serverHeaders() });
    return data;
  } catch (error) {
    throw piError(error, "Impossible d'annuler le paiement Pi");
  }
}

// ---------------------------------------------------------------------------
// Retraits (A2U) via pi-backend
// ---------------------------------------------------------------------------

let a2uClient = null;

/** Permet d'injecter un client de test. */
function setA2UClient(client) {
  a2uClient = client;
}

function getA2UClient() {
  if (a2uClient) return a2uClient;

  if (!process.env.PI_API_KEY || !process.env.PI_WALLET_PRIVATE_SEED) {
    throw new Error('Retraits non configurés : ajoutez PI_API_KEY et PI_WALLET_PRIVATE_SEED dans .env');
  }

  let PiNetwork;
  try {
    const mod = require('pi-backend');
    PiNetwork = mod.default || mod;
  } catch (e) {
    throw new Error('Le paquet pi-backend est manquant : lancez "npm install"');
  }

  a2uClient = new PiNetwork(process.env.PI_API_KEY, process.env.PI_WALLET_PRIVATE_SEED);
  return a2uClient;
}

module.exports = {
  getMe,
  getPayment,
  approvePayment,
  completePayment,
  cancelPayment,
  getA2UClient,
  setA2UClient
};
