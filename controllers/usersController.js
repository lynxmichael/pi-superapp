const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Inscription utilisateur
const register = async (req, res) => {
  try {
    const { piUsername, piUid, walletAddress, email, phone } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({
      $or: [
        { piUsername },
        { piUid },
        { walletAddress },
        { email }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Un utilisateur avec ces informations existe déjà'
      });
    }

    // Créer nouvel utilisateur
    const user = new User({
      piUsername,
      piUid,
      walletAddress,
      email,
      phone,
      profile: req.body.profile || {}
    });

    await user.save();

    // Générer token JWT
    const token = user.generateAuthToken();

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: {
        id: user._id,
        piUsername: user.piUsername,
        walletAddress: user.walletAddress,
        balance: user.balance,
        profile: user.profile
      },
      token
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
};

// Connexion utilisateur
const login = async (req, res) => {
  try {
    const { piUsername, walletAddress } = req.body;

    const user = await User.findOne({
      $or: [
        { piUsername },
        { walletAddress }
      ]
    });

    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Mettre à jour les stats de connexion
    user.stats.lastLogin = new Date();
    user.stats.loginCount += 1;
    await user.save();

    const token = user.generateAuthToken();

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user._id,
        piUsername: user.piUsername,
        walletAddress: user.walletAddress,
        balance: user.balance,
        profile: user.profile
      },
      token
    });
  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
};

// Obtenir le profil utilisateur
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-security.loginPin');

    res.json({ user });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
};

// Mettre à jour le profil
const updateProfile = async (req, res) => {
  try {
    const updates = {};
    
    if (req.body.email) updates.email = req.body.email;
    if (req.body.phone) updates.phone = req.body.phone;
    if (req.body.profile) {
      updates.profile = { ...req.user.profile, ...req.body.profile };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-security.loginPin');

    res.json({
      message: 'Profil mis à jour avec succès',
      user
    });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
};

// Mettre à jour les préférences
const updatePreferences = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { preferences: { ...req.user.preferences, ...req.body } },
      { new: true }
    ).select('-security.loginPin');

    res.json({
      message: 'Préférences mises à jour',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Erreur mise à jour préférences:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des préférences' });
  }
};

// Mettre à jour la sécurité
const updateSecurity = async (req, res) => {
  try {
    const { loginPin, twoFactorEnabled } = req.body;
    const updates = {};

    if (loginPin) updates['security.loginPin'] = loginPin;
    if (typeof twoFactorEnabled === 'boolean') {
      updates['security.twoFactorEnabled'] = twoFactorEnabled;
    }

    await User.findByIdAndUpdate(req.user._id, updates);

    res.json({ message: 'Paramètres de sécurité mis à jour' });
  } catch (error) {
    console.error('Erreur mise à jour sécurité:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la sécurité' });
  }
};

// Vérifier email
const verifyEmail = async (req, res) => {
  try {
    // Implémentation de la vérification d'email
    // Envoyer un email de vérification
    res.json({ message: 'Email de vérification envoyé' });
  } catch (error) {
    console.error('Erreur vérification email:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification de l\'email' });
  }
};

// Demander KYC
const requestKYC = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      'verification.kycStatus': 'pending'
    });

    res.json({ message: 'Demande KYC soumise avec succès' });
  } catch (error) {
    console.error('Erreur demande KYC:', error);
    res.status(500).json({ error: 'Erreur lors de la soumission KYC' });
  }
};

// Obtenir les statistiques
const getStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      stats: {
        totalEarned: user.totalEarned,
        totalSpent: user.totalSpent,
        totalTransactions: user.stats.totalTransactions,
        joinedAt: user.stats.joinedAt,
        loginCount: user.stats.loginCount
      }
    });
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  updatePreferences,
  updateSecurity,
  verifyEmail,
  requestKYC,
  getStats
};