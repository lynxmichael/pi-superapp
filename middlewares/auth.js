const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * 🔐 Authentification obligatoire
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Accès refusé. Token manquant ou invalide.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Vérification JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupération utilisateur
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Token invalide. Utilisateur introuvable.'
      });
    }

    // 🔒 Vérifier statut du compte
    if (user.status !== 'active') {
      return res.status(403).json({
        error: `Compte ${user.status}. Accès refusé.`
      });
    }

    // Injecter l'utilisateur dans la requête
    req.user = user;
    next();

  } catch (error) {
    console.error('AUTH ERROR:', error.message);

    return res.status(401).json({
      error: 'Token invalide ou expiré.'
    });
  }
};

/**
 * 🔓 Authentification optionnelle
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.userId);

      if (user && user.status === 'active') {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    next();
  }
};

// ✅ UN SEUL module.exports
module.exports = { auth, optionalAuth };