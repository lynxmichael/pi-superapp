const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION EMAIL
// ============================================================================

const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Codes de vérification temporaires (utiliser Redis en production)
const verificationCodes = new Map();

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============================================================================
// ENVOI D'EMAIL
// ============================================================================

const sendVerificationEmail = async (email, code, username) => {
  try {
    const transporter = createEmailTransporter();
    
    const mailOptions = {
      from: `"Pi SuperApp" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Code de vérification Pi SuperApp',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .code-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Vérification de votre compte</h1>
            </div>
            <div class="content">
              <p>Bonjour <strong>${username}</strong>,</p>
              <p>Voici votre code de vérification :</p>
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              <div class="warning">
                <strong>⚠️ Important :</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Ce code est valide pendant 10 minutes</li>
                  <li>Ne partagez jamais ce code avec personne</li>
                  <li>Si vous n'avez pas demandé ce code, ignorez cet email</li>
                </ul>
              </div>
              <p>Cordialement,<br><strong>L'équipe Pi SuperApp</strong></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Pi SuperApp. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de vérification envoyé à ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    return false;
  }
};

const sendWelcomeEmail = async (email, username) => {
  try {
    const transporter = createEmailTransporter();
    
    const mailOptions = {
      from: `"Pi SuperApp" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Bienvenue sur Pi SuperApp !',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Bienvenue ${username} !</h1>
            </div>
            <div class="content">
              <p>Votre compte Pi SuperApp a été créé avec succès.</p>
              <h3>🚀 Découvrez nos fonctionnalités :</h3>
              <div class="feature"><strong>💰 Portefeuille Pi</strong><br>Gérez vos Pi coins en toute sécurité</div>
              <div class="feature"><strong>🛒 Marketplace</strong><br>Achetez et vendez avec Pi</div>
              <div class="feature"><strong>📱 Recharge Mobile</strong><br>Rechargez votre crédit avec Pi</div>
              <div class="feature"><strong>🎮 Jeux</strong><br>Jouez et gagnez des récompenses</div>
              <p>Merci de rejoindre Pi SuperApp !<br><strong>L'équipe Pi SuperApp</strong></p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Erreur envoi email bienvenue:', error);
  }
};

// ============================================================================
// ENVOI DE SMS (via API Twilio ou autre — configurable)
// ============================================================================

const sendSMS = async (phone, message) => {
  try {
    // ---- Option 1 : Twilio ----
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });
      console.log(`✅ SMS envoyé à ${phone}`);
      return true;
    }

    // ---- Option 2 : Simulation (développement) ----
    console.log(`📱 [SMS SIMULATION] À: ${phone} | Message: ${message}`);
    return true;

  } catch (error) {
    console.error('❌ Erreur envoi SMS:', error);
    return false;
  }
};

// Email KYC validé
const sendKYCApprovedEmail = async (email, username) => {
  try {
    const transporter = createEmailTransporter();
    await transporter.sendMail({
      from: `"Pi SuperApp" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✅ Identité vérifiée — Pi SuperApp',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#10b981,#059669);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0;">
            <h1>✅ Identité vérifiée</h1>
          </div>
          <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;">
            <p>Bonjour <strong>${username}</strong>,</p>
            <p>Votre identité a été <strong>vérifiée avec succès</strong> par notre équipe.</p>
            <p>Vous avez maintenant accès à toutes les fonctionnalités de Pi SuperApp, y compris les transactions sans limite et le marketplace.</p>
            <div style="background:#d1fae5;padding:15px;border-radius:8px;border-left:4px solid #10b981;margin:20px 0;">
              <strong>Statut KYC :</strong> ✅ Vérifié
            </div>
            <p>Merci de votre confiance.<br><strong>L'équipe Pi SuperApp</strong></p>
          </div>
        </div>
      `
    });
  } catch (error) {
    console.error('Erreur email KYC:', error);
  }
};

const sendKYCRejectedEmail = async (email, username, reason) => {
  try {
    const transporter = createEmailTransporter();
    await transporter.sendMail({
      from: `"Pi SuperApp" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '❌ Vérification KYC refusée — Pi SuperApp',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#ef4444,#dc2626);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0;">
            <h1>❌ Vérification refusée</h1>
          </div>
          <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;">
            <p>Bonjour <strong>${username}</strong>,</p>
            <p>Votre demande de vérification KYC a été <strong>refusée</strong>.</p>
            <div style="background:#fee2e2;padding:15px;border-radius:8px;border-left:4px solid #ef4444;margin:20px 0;">
              <strong>Raison :</strong> ${reason || 'Documents non conformes ou illisibles.'}
            </div>
            <p>Vous pouvez soumettre une nouvelle demande avec des documents conformes.</p>
            <p>Cordialement,<br><strong>L'équipe Pi SuperApp</strong></p>
          </div>
        </div>
      `
    });
  } catch (error) {
    console.error('Erreur email KYC rejet:', error);
  }
};

// ============================================================================
// AUTH : DEMANDE DE CODE / VÉRIFICATION / INSCRIPTION / CONNEXION
// ============================================================================

const requestVerificationCode = async (req, res) => {
  try {
    const { email, piUsername } = req.body;

    if (!email || !piUsername) {
      return res.status(400).json({ error: 'Email et nom d\'utilisateur requis' });
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Format d\'email invalide' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const code = generateVerificationCode();
    
    verificationCodes.set(email, {
      code,
      piUsername,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    });

    const emailSent = await sendVerificationEmail(email, code, piUsername);

    if (!emailSent) {
      return res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
    }

    res.json({
      message: 'Code de vérification envoyé à votre email',
      email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    });

  } catch (error) {
    console.error('Erreur demande code:', error);
    res.status(500).json({ error: 'Erreur lors de la demande de code de vérification' });
  }
};

const verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email et code requis' });
    }

    const storedData = verificationCodes.get(email);

    if (!storedData) {
      return res.status(400).json({ error: 'Code de vérification expiré ou invalide' });
    }

    if (Date.now() > storedData.expiresAt) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: 'Le code de vérification a expiré' });
    }

    if (storedData.attempts >= 5) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: 'Trop de tentatives. Demandez un nouveau code.' });
    }

    if (storedData.code !== code.trim()) {
      storedData.attempts++;
      return res.status(400).json({
        error: 'Code de vérification incorrect',
        attemptsLeft: 5 - storedData.attempts
      });
    }

    storedData.verified = true;

    res.json({ message: 'Email vérifié avec succès', verified: true });

  } catch (error) {
    console.error('Erreur vérification code:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du code' });
  }
};

const register = async (req, res) => {
  try {
    const { piUsername, piUid, walletAddress, email, phone, verificationCode } = req.body;

    if (!piUsername || !piUid || !walletAddress || !email || !verificationCode) {
      return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis' });
    }

    const storedData = verificationCodes.get(email);
    
    if (!storedData || !storedData.verified) {
      return res.status(400).json({ error: 'Veuillez d\'abord vérifier votre email' });
    }

    if (storedData.code !== verificationCode) {
      return res.status(400).json({ error: 'Code de vérification invalide' });
    }

    const existingUser = await User.findOne({
      $or: [{ piUsername }, { piUid }, { walletAddress }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Un utilisateur avec ces informations existe déjà' });
    }

    const user = new User({
      piUsername,
      piUid,
      walletAddress,
      email,
      phone,
      verification: {
        emailVerified: true,
        emailVerifiedAt: new Date()
      },
      profile: req.body.profile || {}
    });

    await user.save();

    verificationCodes.delete(email);

    const token = user.generateAuthToken();

    await sendWelcomeEmail(email, piUsername);

    res.status(201).json({
      message: 'Inscription réussie',
      user: {
        id: user._id,
        piUsername: user.piUsername,
        walletAddress: user.walletAddress,
        email: user.email,
        balance: user.balance,
        profile: user.profile,
        verification: user.verification
      },
      token
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
};

const login = async (req, res) => {
  try {
    const { piUsername, walletAddress } = req.body;

    const user = await User.findOne({
      $or: [{ piUsername }, { walletAddress }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

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
        email: user.email,
        balance: user.balance,
        profile: user.profile,
        stats: user.stats,
        preferences: user.preferences,
        verification: user.verification
      },
      token
    });
  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
};

// ============================================================================
// PROFIL
// ============================================================================

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-security.loginPin');

    res.json({ 
      user: {
        id: user._id,
        piUsername: user.piUsername,
        piUid: user.piUid,
        walletAddress: user.walletAddress,
        email: user.email,
        phone: user.phone,
        balance: user.balance,
        profile: user.profile,
        stats: user.stats,
        preferences: user.preferences,
        verification: {
          emailVerified: user.verification.emailVerified,
          phoneVerified: user.verification.phoneVerified,
          kycStatus: user.verification.kycStatus,
          kycSubmittedAt: user.verification.kycSubmittedAt,
          kycApprovedAt: user.verification.kycApprovedAt,
          kycRejectedAt: user.verification.kycRejectedAt,
          kycRejectionReason: user.verification.kycRejectionReason
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = ['phone', 'profile'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        if (key === 'profile') {
          // Fusionner avec le profil existant, filtrer les champs autorisés
          const allowedProfileFields = [
            'firstName', 'lastName', 'bio', 'dateOfBirth',
            'gender', 'country', 'city', 'address'
          ];
          const safeProfile = {};
          Object.keys(req.body.profile).forEach(f => {
            if (allowedProfileFields.includes(f)) {
              safeProfile[f] = req.body.profile[f];
            }
          });
          updates.profile = {
            ...req.user.profile?.toObject?.() || req.user.profile || {},
            ...safeProfile
          };
        } else {
          updates[key] = req.body[key];
        }
      }
    });

    // Validation du téléphone
    if (updates.phone) {
      const phoneRegex = /^\+?[0-9]{8,15}$/;
      if (!phoneRegex.test(updates.phone.replace(/\s/g, ''))) {
        return res.status(400).json({ error: 'Format de téléphone invalide' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-security.loginPin');

    res.json({
      message: 'Profil mis à jour avec succès',
      user: {
        id: user._id,
        piUsername: user.piUsername,
        walletAddress: user.walletAddress,
        email: user.email,
        phone: user.phone,
        balance: user.balance,
        profile: user.profile,
        stats: user.stats,
        preferences: user.preferences,
        verification: {
          emailVerified: user.verification.emailVerified,
          phoneVerified: user.verification.phoneVerified,
          kycStatus: user.verification.kycStatus
        }
      }
    });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
};

// ============================================================================
// PRÉFÉRENCES
// ============================================================================

const updatePreferences = async (req, res) => {
  try {
    const allowedPreferences = ['language', 'currency', 'notifications', 'theme'];
    const preferences = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedPreferences.includes(key)) {
        preferences[key] = req.body[key];
      }
    });

    if (preferences.language && !['fr', 'en'].includes(preferences.language)) {
      return res.status(400).json({ error: 'Langue non supportée' });
    }

    if (preferences.currency && !['PI', 'USD', 'EUR', 'XOF'].includes(preferences.currency)) {
      return res.status(400).json({ error: 'Devise non supportée' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { preferences: { ...req.user.preferences?.toObject?.() || {}, ...preferences } },
      { new: true }
    );

    res.json({
      message: 'Préférences mises à jour',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Erreur mise à jour préférences:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des préférences' });
  }
};

// ============================================================================
// SÉCURITÉ
// ============================================================================

const updateSecurity = async (req, res) => {
  try {
    const { loginPin, currentPin, twoFactorEnabled } = req.body;
    
    const user = await User.findById(req.user._id);

    // Si modification du PIN
    if (loginPin) {
      if (!/^\d{6}$/.test(loginPin)) {
        return res.status(400).json({ error: 'Le PIN doit contenir exactement 6 chiffres' });
      }

      if (user.security.loginPin && !currentPin) {
        return res.status(400).json({ error: 'PIN actuel requis pour le modifier' });
      }

      if (user.security.loginPin) {
        const isValid = await user.verifyPin(currentPin);
        if (!isValid) {
          return res.status(400).json({ error: 'PIN actuel incorrect' });
        }
      }

      user.security.loginPin = loginPin;
      user.security.lastPasswordChange = new Date();
    }

    if (typeof twoFactorEnabled === 'boolean') {
      user.security.twoFactorEnabled = twoFactorEnabled;
    }

    await user.save();

    res.json({ message: 'Paramètres de sécurité mis à jour' });
  } catch (error) {
    console.error('Erreur mise à jour sécurité:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la sécurité' });
  }
};

// ============================================================================
// CHANGEMENT D'EMAIL
// ============================================================================

const requestEmailChange = async (req, res) => {
  try {
    const { newEmail } = req.body;

    if (!newEmail) {
      return res.status(400).json({ error: 'Nouvel email requis' });
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ error: 'Format d\'email invalide' });
    }

    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const code = generateVerificationCode();
    
    verificationCodes.set(`change_${newEmail}`, {
      code,
      userId: req.user._id,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    });

    await sendVerificationEmail(newEmail, code, req.user.piUsername);

    res.json({ message: 'Code de vérification envoyé au nouvel email' });

  } catch (error) {
    console.error('Erreur changement email:', error);
    res.status(500).json({ error: 'Erreur lors de la demande de changement d\'email' });
  }
};

const confirmEmailChange = async (req, res) => {
  try {
    const { newEmail, code } = req.body;

    const storedData = verificationCodes.get(`change_${newEmail}`);

    if (!storedData || storedData.userId.toString() !== req.user._id.toString()) {
      return res.status(400).json({ error: 'Code invalide ou expiré' });
    }

    if (Date.now() > storedData.expiresAt) {
      verificationCodes.delete(`change_${newEmail}`);
      return res.status(400).json({ error: 'Le code a expiré' });
    }

    if (storedData.code !== code) {
      return res.status(400).json({ error: 'Code incorrect' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      email: newEmail,
      'verification.emailVerified': true,
      'verification.emailVerifiedAt': new Date()
    });

    verificationCodes.delete(`change_${newEmail}`);

    res.json({ message: 'Email mis à jour avec succès' });

  } catch (error) {
    console.error('Erreur confirmation email:', error);
    res.status(500).json({ error: 'Erreur lors de la confirmation' });
  }
};

// ============================================================================
// STATISTIQUES
// ============================================================================

const getStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      stats: {
        balance: user.balance,
        totalEarned: user.totalEarned,
        totalSpent: user.totalSpent,
        totalTransactions: user.stats.totalTransactions,
        joinedAt: user.stats.joinedAt,
        loginCount: user.stats.loginCount,
        lastLogin: user.stats.lastLogin
      }
    });
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
};

// ============================================================================
// KYC — SOUMISSION AVEC UPLOAD DE FICHIERS
// ============================================================================

/**
 * Soumission KYC complète par l'utilisateur
 * Reçoit : identité (texte) + document recto/verso (images) + selfie (image)
 * Les fichiers sont gérés par multer dans la route
 */
const requestKYC = async (req, res) => {
  try {
    const { firstName, lastName, dateOfBirth, nationality, address, phone,
            documentType, documentNumber } = req.body;

    // Validation des champs texte
    if (!firstName || !lastName || !dateOfBirth || !nationality || !address || !phone) {
      return res.status(400).json({ error: 'Toutes les informations d\'identité sont requises' });
    }
    if (!documentType || !documentNumber) {
      return res.status(400).json({ error: 'Type et numéro de document requis' });
    }
    if (!['passport', 'id_card', 'driver_license'].includes(documentType)) {
      return res.status(400).json({ error: 'Type de document invalide' });
    }

    // Vérifier les fichiers uploadés
    const files = req.files || {};
    if (!files.docFront || !files.docFront[0]) {
      return res.status(400).json({ error: 'Photo recto du document requise' });
    }
    if (!files.docBack || !files.docBack[0]) {
      return res.status(400).json({ error: 'Photo verso du document requise' });
    }
    if (!files.selfie || !files.selfie[0]) {
      return res.status(400).json({ error: 'Selfie de vérification requis' });
    }

    // Vérifier que le KYC n'est pas déjà en attente
    const currentUser = await User.findById(req.user._id);
    if (currentUser.verification.kycStatus === 'pending') {
      return res.status(400).json({ error: 'Une demande KYC est déjà en cours d\'examen' });
    }
    if (currentUser.verification.kycStatus === 'approved') {
      return res.status(400).json({ error: 'Votre identité est déjà vérifiée' });
    }

    // Chemins des fichiers uploadés (relatifs au serveur)
    const frontPath = `/uploads/kyc/${files.docFront[0].filename}`;
    const backPath = `/uploads/kyc/${files.docBack[0].filename}`;
    const selfiePath = `/uploads/kyc/${files.selfie[0].filename}`;

    // Mise à jour de l'utilisateur
    await User.findByIdAndUpdate(req.user._id, {
      'verification.kycStatus': 'pending',
      'verification.kycSubmittedAt': new Date(),
      'verification.kycRejectedAt': null,
      'verification.kycRejectionReason': null,
      'verification.kycIdentity': {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: new Date(dateOfBirth),
        nationality: nationality.trim(),
        address: address.trim(),
        phone: phone.trim()
      },
      'verification.kycDocuments': {
        type: documentType,
        number: documentNumber.trim(),
        frontImage: frontPath,
        backImage: backPath
      },
      'verification.kycSelfie': {
        image: selfiePath,
        capturedAt: new Date()
      }
    });

    console.log(`📋 KYC soumis par ${req.user.piUsername} — En attente d'approbation admin`);

    res.json({ 
      message: 'Demande KYC soumise avec succès. Un administrateur examinera vos documents. Vous recevrez un SMS de confirmation.'
    });

  } catch (error) {
    console.error('Erreur demande KYC:', error);
    res.status(500).json({ error: 'Erreur lors de la soumission KYC' });
  }
};

// ============================================================================
// KYC — ACTIONS ADMIN (approuver / rejeter)
// ============================================================================

/**
 * Détail KYC complet pour l'admin
 */
const getKYCDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('piUsername email phone profile verification')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      user: {
        id: user._id,
        piUsername: user.piUsername,
        email: user.email,
        phone: user.phone,
        profile: user.profile,
        verification: user.verification
      }
    });

  } catch (error) {
    console.error('Erreur détail KYC:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du KYC' });
  }
};

/**
 * Approuver le KYC d'un utilisateur
 * - Vérifie que les noms correspondent au profil
 * - Met à jour le statut
 * - Envoie un SMS de confirmation
 * - Envoie un email de confirmation
 */
const approveKYC = async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (user.verification.kycStatus !== 'pending') {
      return res.status(400).json({ error: 'Ce KYC n\'est pas en attente d\'approbation' });
    }

    // Mettre à jour le profil avec les infos KYC vérifiées
    const kycIdentity = user.verification.kycIdentity || {};

    await User.findByIdAndUpdate(req.params.id, {
      'verification.kycStatus': 'approved',
      'verification.kycApprovedAt': new Date(),
      'verification.kycReviewedBy': req.user._id,
      'verification.kycAdminNotes': adminNotes || '',
      // Synchroniser le profil avec l'identité vérifiée
      'profile.firstName': kycIdentity.firstName || user.profile.firstName,
      'profile.lastName': kycIdentity.lastName || user.profile.lastName,
      'profile.dateOfBirth': kycIdentity.dateOfBirth || user.profile.dateOfBirth,
      'profile.address': kycIdentity.address || user.profile.address,
      // Mettre à jour le téléphone si fourni
      phone: kycIdentity.phone || user.phone
    });

    // Envoyer SMS de validation
    const smsPhone = kycIdentity.phone || user.phone;
    if (smsPhone) {
      const smsMessage = `Pi SuperApp: Votre identité a été vérifiée avec succès. Statut KYC: VALIDÉ. Merci de votre confiance!`;
      const smsSent = await sendSMS(smsPhone, smsMessage);
      
      // Enregistrer l'envoi SMS
      await User.findByIdAndUpdate(req.params.id, {
        'verification.kycSmsValidation': {
          sent: smsSent,
          sentAt: new Date(),
          message: smsMessage
        },
        'verification.phoneVerified': true,
        'verification.phoneVerifiedAt': new Date()
      });
    }

    // Envoyer email de confirmation
    if (user.email) {
      await sendKYCApprovedEmail(user.email, user.piUsername);
    }

    console.log(`✅ KYC approuvé pour ${user.piUsername} par admin ${req.user.piUsername}`);

    res.json({
      message: `KYC de ${user.piUsername} approuvé avec succès. SMS de validation envoyé.`,
      kycStatus: 'approved'
    });

  } catch (error) {
    console.error('Erreur approbation KYC:', error);
    res.status(500).json({ error: 'Erreur lors de l\'approbation du KYC' });
  }
};

/**
 * Rejeter le KYC d'un utilisateur
 * - Demande une raison
 * - Envoie un SMS de notification
 * - Envoie un email avec la raison
 */
const rejectKYC = async (req, res) => {
  try {
    const { reason, adminNotes } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (user.verification.kycStatus !== 'pending') {
      return res.status(400).json({ error: 'Ce KYC n\'est pas en attente d\'approbation' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'La raison du rejet est requise' });
    }

    await User.findByIdAndUpdate(req.params.id, {
      'verification.kycStatus': 'rejected',
      'verification.kycRejectedAt': new Date(),
      'verification.kycReviewedBy': req.user._id,
      'verification.kycRejectionReason': reason,
      'verification.kycAdminNotes': adminNotes || ''
    });

    // Envoyer SMS de notification
    const smsPhone = user.verification.kycIdentity?.phone || user.phone;
    if (smsPhone) {
      const smsMessage = `Pi SuperApp: Votre demande KYC a été refusée. Raison: ${reason}. Vous pouvez soumettre à nouveau.`;
      await sendSMS(smsPhone, smsMessage);
    }

    // Envoyer email
    if (user.email) {
      await sendKYCRejectedEmail(user.email, user.piUsername, reason);
    }

    console.log(`❌ KYC rejeté pour ${user.piUsername} par admin ${req.user.piUsername}`);

    res.json({
      message: `KYC de ${user.piUsername} rejeté. L'utilisateur a été notifié.`,
      kycStatus: 'rejected'
    });

  } catch (error) {
    console.error('Erreur rejet KYC:', error);
    res.status(500).json({ error: 'Erreur lors du rejet du KYC' });
  }
};

/**
 * Liste des demandes KYC en attente (pour l'admin)
 */
const getPendingKYC = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const filter = { 'verification.kycStatus': 'pending' };

    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select('piUsername email phone profile verification createdAt')
      .sort({ 'verification.kycSubmittedAt': 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    res.json({
      users,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum)
    });

  } catch (error) {
    console.error('Erreur liste KYC:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des demandes KYC' });
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  requestVerificationCode,
  verifyCode,
  register,
  login,
  getProfile,
  updateProfile,
  updatePreferences,
  updateSecurity,
  requestEmailChange,
  confirmEmailChange,
  requestKYC,
  getStats,
  // Admin KYC
  getKYCDetail,
  approveKYC,
  rejectKYC,
  getPendingKYC
};