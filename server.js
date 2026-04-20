require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const { connectDB, createIndexes, checkDatabaseStatus } = require('./config/database');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const app = express();

// Middlewares de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Servir les uploads (images KYC, avatars)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialisation
const initializeApp = async () => {
  try {
    console.log('🔄 Connexion à la base de données...');
    await connectDB();
    
    console.log('🔄 Chargement des modèles...');
    require('./models/User');
    require('./models/Transaction');
    require('./models/Payment');
    require('./models/Product');
    require('./models/Wallet');
    
    console.log('✅ Tous les modèles chargés');
    
    await createIndexes();
    await checkDatabaseStatus();
    
    if (process.env.NODE_ENV === 'development') {
      const seedDatabase = require('./scripts/seedDatabase');
      await seedDatabase();
    }
    
  } catch (error) {
    console.error('❌ Erreur initialisation:', error);
    process.exit(1);
  }
};

// ============================================================================
// ⭐⭐⭐ ROUTES AUTH ADMIN — DIRECTEMENT ICI ⭐⭐⭐
// Pas besoin de fichier séparé. Ça marche à 100%.
// ============================================================================

const User = require('./models/User');
const ADMIN_SECRET = process.env.ADMIN_REGISTRATION_CODE;

// ---- TEST : visitez /api/admin/auth/test pour vérifier ----
app.get('/api/admin/auth/test', (req, res) => {
  res.json({
    message: '✅ Routes admin auth OK !',
    adminSecretConfigured: !!ADMIN_SECRET,
    timestamp: new Date().toISOString()
  });
});

// ---- INSCRIPTION ADMIN ----
app.post('/api/admin/auth/register', async (req, res) => {
  try {
    const { piUsername, piUid, walletAddress, email, phone, pin, adminCode, role } = req.body;

    console.log('📋 Tentative inscription admin:', piUsername, email);

    if (!ADMIN_SECRET) {
      console.error('❌ ADMIN_REGISTRATION_CODE non défini dans .env !');
      return res.status(500).json({
        error: 'ADMIN_REGISTRATION_CODE non défini dans .env. Ajoutez-le et redémarrez.'
      });
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
      if (existingUser.piUsername === piUsername) field = 'Nom d\'utilisateur';
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

    console.log(`✅ Compte admin créé avec succès : ${piUsername}`);

    res.status(201).json({
      message: 'Compte administrateur créé avec succès',
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Erreur inscription admin:', error);
    res.status(500).json({ error: 'Erreur lors de l\'inscription: ' + error.message });
  }
});

// ---- CONNEXION ADMIN ----
app.post('/api/admin/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    console.log('🔑 Tentative connexion admin:', identifier);

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { piUsername: identifier }, { piUid: identifier }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    if (user.role !== 'admin' && user.role !== 'moderator') {
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

    console.log(`✅ Connexion admin réussie : ${user.piUsername}`);

    res.json({
      message: 'Connexion réussie',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('❌ Erreur login admin:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// ============================================================================
// CHARGEMENT DES ROUTES (fichiers séparés)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('🔄 CHARGEMENT DES ROUTES');
console.log('='.repeat(80) + '\n');

console.log('✅ /api/admin/auth/register → INTÉGRÉ dans server.js');
console.log('✅ /api/admin/auth/login    → INTÉGRÉ dans server.js');
console.log('✅ /api/admin/auth/test     → INTÉGRÉ dans server.js');

try {
  // Routes authentification utilisateur
  console.log('📂 Chargement de userRoutes.js...');
  const userRoutes = require('./routes/userRoutes');
  app.use('/api/auth', userRoutes);
  console.log('✅ /api/auth → userRoutes');

  // Routes wallet
  console.log('📂 Chargement de walletRoutes.js...');
  const walletRoutes = require('./routes/walletRoutes');
  app.use('/api/wallet', walletRoutes);
  console.log('✅ /api/wallet → walletRoutes');

  // Routes marketplace
  console.log('📂 Chargement de marketplaceRoutes.js...');
  const marketplaceRoutes = require('./routes/marketplaceRoutes');
  app.use('/api/marketplace', marketplaceRoutes);
  console.log('✅ /api/marketplace → marketplaceRoutes');

  // Routes transactions
  console.log('📂 Chargement de transactionRoutes.js...');
  const transactionRoutes = require('./routes/transactionRoutes');
  app.use('/api/transactions', transactionRoutes);
  console.log('✅ /api/transactions → transactionRoutes');

  // Routes admin (gestion utilisateurs, KYC, wallets)
  console.log('📂 Chargement de adminUsersRoutes.js...');
  const adminUsersRoutes = require('./routes/adminUsersRoutes');
  app.use('/api/admin', adminUsersRoutes);
  console.log('✅ /api/admin → adminUsersRoutes');

  // Routes payments
  console.log('📂 Chargement de paymentRoutes.js...');
  const paymentRoutes = require('./routes/paymentRoutes');
  app.use('/api/payments', paymentRoutes);
  console.log('✅ /api/payments → paymentRoutes');

  // Routes optionnelles
  const optionalRoutes = [
    { name: 'ecommerceRoutes', path: './routes/ecommerceRoutes', mount: '/api/ecommerce' },
    { name: 'subscriptionRoutes', path: './routes/subscriptionRoutes', mount: '/api/subscriptions' },
    { name: 'reservationRoutes', path: './routes/reservationRoutes', mount: '/api/reservations' },
    { name: 'gameRoutes', path: './routes/gameRoutes', mount: '/api/games' },
    { name: 'filesRoutes', path: './routes/filesRoutes', mount: '/api/files' },
    { name: 'rechargeRoutes', path: './routes/rechargeRoutes', mount: '/api/recharge' }
  ];

  optionalRoutes.forEach(({ name, path: routePath, mount }) => {
    try {
      console.log(`📂 Chargement de ${name}...`);
      const route = require(routePath);
      app.use(mount, route);
      console.log(`✅ ${mount} → ${name}`);
    } catch (error) {
      console.log(`⚠️ ${name} non disponible:`, error.message);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ ROUTES CHARGÉES AVEC SUCCÈS');
  console.log('='.repeat(80) + '\n');

} catch (error) {
  console.error('\n❌ ERREUR CRITIQUE lors du chargement des routes:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}

// ============================================================================
// PAGES ADMIN HTML
// ============================================================================

app.get('/admin/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-auth.html'));
});

app.get('/admin/users', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-user.html'));
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/users');
});

// ============================================================================
// ROUTES UTILITAIRES
// ============================================================================

// Route de santé
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const statusText = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    }[dbStatus];

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: statusText,
      service: 'Pi SuperApp API'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route de test auth
app.get('/api/auth/test', (req, res) => {
  res.json({ message: '✅ Auth router fonctionne!' });
});

// Gestion 404
app.use('*', (req, res) => {
  console.log(`❌ 404 - ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method
  });
});

// Gestion d'erreurs
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

const PORT = process.env.PORT || 3000;

// Démarrer le serveur
initializeApp().then(() => {
  app.listen(PORT, () => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 SERVEUR DÉMARRÉ AVEC SUCCÈS');
    console.log('='.repeat(80));
    console.log(`🔡 Port: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🔑 Admin: http://localhost:${PORT}/admin/auth`);
    console.log(`🧪 Test:  http://localhost:${PORT}/api/admin/auth/test`);
    console.log('='.repeat(80) + '\n');
  });
}).catch(error => {
  console.error('❌ Impossible de démarrer:', error);
  process.exit(1);
});

module.exports = app;