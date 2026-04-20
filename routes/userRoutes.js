const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Importer le contrôleur
const {
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
  getStats
} = require('../controllers/usersController');

// Middleware d'authentification
const { auth } = require('../middlewares/auth');

// ============================================================================
// CONFIGURATION MULTER POUR UPLOAD KYC
// ============================================================================

const kycUploadDir = path.join(__dirname, '..', 'uploads', 'kyc');
if (!fs.existsSync(kycUploadDir)) {
  fs.mkdirSync(kycUploadDir, { recursive: true });
}

const kycStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, kycUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    const userId = req.user ? req.user._id : 'unknown';
    cb(null, `kyc-${userId}-${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const kycUpload = multer({
  storage: kycStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images JPG, PNG et WebP sont acceptées'));
    }
  }
});

// ============================================================================
// ROUTES PUBLIQUES
// ============================================================================

router.post('/request-code', requestVerificationCode);
router.post('/verify-code', verifyCode);
router.post('/register', register);
router.post('/login', login);

// ============================================================================
// ROUTES PROTÉGÉES
// ============================================================================

// Profil
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);

// Préférences
router.put('/preferences', auth, updatePreferences);

// Sécurité
router.put('/security', auth, updateSecurity);

// Changement d'email
router.post('/change-email', auth, requestEmailChange);
router.post('/confirm-email-change', auth, confirmEmailChange);

// KYC avec upload de fichiers (recto, verso, selfie)
router.post('/kyc', auth, (req, res, next) => {
  kycUpload.fields([
    { name: 'docFront', maxCount: 1 },
    { name: 'docBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }
  ])(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Fichier trop volumineux (max 5 MB)' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, requestKYC);

// Statistiques
router.get('/stats', auth, getStats);

module.exports = router;