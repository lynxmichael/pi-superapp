const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const {
  register,
  login,
  getProfile,
  updateProfile,
  updatePreferences,
  verifyEmail,
  requestKYC,
  updateSecurity,
  getStats
} = require('../controllers/usersController');

// Routes d'authentification
router.post('/register', register);
router.post('/login', login);

// Routes profil utilisateur
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.put('/preferences', auth, updatePreferences);
router.put('/security', auth, updateSecurity);

// Vérification et KYC
router.post('/verify-email', auth, verifyEmail);
router.post('/request-kyc', auth, requestKYC);

// Statistiques
router.get('/stats', auth, getStats);

module.exports = router;