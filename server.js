require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const { connectDB, checkDatabaseStatus } = require('./config/database');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant dans .env : ajoutez une longue chaîne secrète puis relancez.');
  process.exit(1);
}

// Anciens services (marketplace, jeux, recharge, KYC, transferts...) : désactivés
// par défaut pour garder l'application simple. ATTENTION : leur ancienne connexion
// ne demande pas de mot de passe, ne les activez pas en production.
const LEGACY = String(process.env.ENABLE_LEGACY_SERVICES || '').toLowerCase() === 'true';

const app = express();

// Sécurité. Le SDK Pi est chargé depuis sdk.minepi.com, et le bac à sable Pi
// (sandbox.minepi.com) affiche l'application dans un cadre.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://sdk.minepi.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://*.minepi.com'],
      frameSrc: ["'self'", 'https://*.minepi.com'],
      frameAncestors: ["'self'", 'https://*.minepi.com', 'https://*.pinet.com'],
      mediaSrc: ["'self'", 'blob:']
    }
  },
  frameguard: false,
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================================
// Démarrage : base de données et index
// ============================================================================

const User = require('./models/User');
const PiOperation = require('./models/PiOperation');

const initializeApp = async () => {
  await connectDB();

  // Met les index à jour (email et wallet devenus optionnels, nouvelle collection des opérations)
  try {
    await User.syncIndexes();
    await PiOperation.syncIndexes();
  } catch (error) {
    console.error('⚠️  Mise à jour des index impossible :', error.message);
  }

  // Les anciens soldes (100 π offerts, etc.) ne viennent pas de vrais dépôts : on les recalcule une fois
  await require('./scripts/migrateBalances')();

  await checkDatabaseStatus();

  if (LEGACY && process.env.NODE_ENV === 'development') {
    const seedDatabase = require('./scripts/seedDatabase');
    await seedDatabase();
  }
};

// ============================================================================
// Connexion admin (code PIN) — utile depuis un ordinateur, hors du Pi Browser
// ============================================================================

const ADMIN_SECRET = process.env.ADMIN_REGISTRATION_CODE;

app.post('/api/admin/auth/register', async (req, res) => {
  try {
    const { piUsername, piUid, walletAddress, email, phone, pin, adminCode, role } = req.body;

    if (!ADMIN_SECRET) {
      return res.status(500).json({ error: 'ADMIN_REGISTRATION_CODE non défini dans .env. Ajoutez-le et redémarrez.' });
    }
    if (adminCode !== ADMIN_SECRET) {
      return res.status(403).json({ error: 'Code secret invalide' });
    }
    if (role !== 'admin') {
      return res.status(400).json({ error: 'Seuls les comptes admin ici' });
    }
    if (!piUsername || !piUid || !walletAddress || !email || !pin) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'Le PIN doit contenir exactement 6 chiffres' });
    }

    const existingUser = await User.findOne({
      $or: [{ piUsername }, { piUid }, { walletAddress }, { email }]
    });
    if (existingUser) {
      let field = '';
      if (existingUser.piUsername === piUsername) field = "Nom d'utilisateur";
      else if (existingUser.piUid === piUid) field = 'Pi UID';
      else if (existingUser.walletAddress === walletAddress) field = 'Adresse wallet';
      else if (existingUser.email === email) field = 'Email';
      return res.status(400).json({ error: `${field} déjà utilisé` });
    }

    const user = new User({
      piUsername,
      piUid,
      walletAddress,
      email,
      phone: phone || undefined,
      role: 'admin',
      status: 'active',
      security: { loginPin: pin }
    });
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.security;
    delete userResponse.__v;

    res.status(201).json({ message: 'Compte administrateur créé avec succès', user: userResponse });
  } catch (error) {
    console.error('❌ Erreur inscription admin:', error);
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

app.post('/api/admin/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { piUsername: identifier }, { piUid: identifier }]
    });
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès non autorisé. Compte non administrateur.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: `Compte ${user.status}. Contactez l'administrateur.` });
    }

    const isValid = await user.verifyPin(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = user.generateAuthToken();
    user.stats.lastLogin = new Date();
    user.stats.loginCount += 1;
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.security;
    delete userResponse.__v;

    res.json({ message: 'Connexion réussie', token, user: userResponse });
  } catch (error) {
    console.error('❌ Erreur login admin:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// ============================================================================
// Routes API
// ============================================================================

// Dépôts, retraits, connexion Pi
app.use('/api/pi', require('./routes/piRoutes'));

// Gestion des utilisateurs (admin)
app.use('/api/admin', require('./routes/adminUsersRoutes'));

if (LEGACY) {
  console.log('⚠️  Anciens services activés (ENABLE_LEGACY_SERVICES=true)');
  const legacyRoutes = [
    ['/api/auth', './routes/userRoutes'],
    ['/api/wallet', './routes/walletRoutes'],
    ['/api/marketplace', './routes/marketplaceRoutes'],
    ['/api/transactions', './routes/transactionRoutes'],
    ['/api/payments', './routes/paymentRoutes'],
    ['/api/ecommerce', './routes/ecommerceRoutes'],
    ['/api/subscriptions', './routes/subscriptionRoutes'],
    ['/api/reservations', './routes/reservationRoutes'],
    ['/api/games', './routes/gameRoutes'],
    ['/api/files', './routes/filesRoutes'],
    ['/api/recharge', './routes/rechargeRoutes']
  ];
  legacyRoutes.forEach(([mount, routePath]) => {
    try {
      app.use(mount, require(routePath));
    } catch (error) {
      console.log(`⚠️  ${routePath} non disponible :`, error.message);
    }
  });
}

// ============================================================================
// Pages
// ============================================================================

app.get('/admin/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-auth.html'));
});

app.get('/admin/retraits', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-retraits.html'));
});

app.get('/admin/users', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-user.html'));
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/retraits');
});

app.get('/api/health', (req, res) => {
  const statusText = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  }[mongoose.connection.readyState];

  res.json({ status: 'OK', timestamp: new Date().toISOString(), database: statusText });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée', path: req.originalUrl });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  initializeApp().then(() => {
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`🚀 pi-superapp démarré : http://localhost:${PORT}`);
      console.log(`🔑 Admin des retraits : http://localhost:${PORT}/admin/retraits`);
      console.log(`🧪 Mode bac à sable Pi : ${String(process.env.PI_SANDBOX).toLowerCase() === 'true' ? 'oui' : 'non'}`);
      console.log('='.repeat(60) + '\n');
    });
  }).catch((error) => {
    console.error('❌ Impossible de démarrer :', error);
    process.exit(1);
  });
}

module.exports = { app, initializeApp };
