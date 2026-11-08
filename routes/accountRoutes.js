/**
 * Mon compte : profil et vérification d'identité (KYC).
 * Les documents KYC sont rangés dans uploads/kyc, qui n'est PAS servi publiquement :
 * seuls les admins y accèdent, via /api/admin/kyc-file/:nom.
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { auth } = require('../middlewares/auth');
const { requestKYC } = require('../controllers/usersController');
const { handle, cleanText } = require('../utils/http');
const User = require('../models/User');

const router = express.Router();

const KYC_DIR = path.join(__dirname, '..', 'uploads', 'kyc');
fs.mkdirSync(KYC_DIR, { recursive: true });

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const kycUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, KYC_DIR),
    filename: (req, file, cb) => {
      cb(null, `kyc-${req.user._id}-${file.fieldname}-${crypto.randomBytes(12).toString('hex')}${IMAGE_TYPES[file.mimetype]}`);
    }
  }),
  limits: { fileSize: 6 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype]) return cb(null, true);
    cb(new Error('Photos uniquement (JPG, PNG ou WebP).'));
  }
});

function kycFields(req, res, next) {
  kycUpload.fields([
    { name: 'docFront', maxCount: 1 },
    { name: 'docBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }
  ])(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop lourde (6 Mo maximum).' : err.message;
    res.status(400).json({ error: message });
  });
}

function accountView(user) {
  const v = user.verification || {};
  return {
    piUsername: user.piUsername,
    phone: user.phone || '',
    email: user.email || '',
    profile: {
      firstName: (user.profile && user.profile.firstName) || '',
      lastName: (user.profile && user.profile.lastName) || '',
      city: (user.profile && user.profile.city) || '',
      country: (user.profile && user.profile.country) || ''
    },
    kyc: {
      status: v.kycStatus || 'none',
      submittedAt: v.kycSubmittedAt,
      approvedAt: v.kycApprovedAt,
      rejectionReason: v.kycStatus === 'rejected' ? v.kycRejectionReason : undefined
    }
  };
}

router.get('/', auth, handle(async (req, res) => {
  res.json({ account: accountView(req.user) });
}));

router.put('/', auth, handle(async (req, res) => {
  const body = req.body || {};
  const update = {
    'profile.firstName': cleanText(body.firstName, 50),
    'profile.lastName': cleanText(body.lastName, 50),
    'profile.city': cleanText(body.city, 80),
    'profile.country': cleanText(body.country, 80)
  };
  const phone = cleanText(body.phone, 20);
  if (phone) update.phone = phone;
  const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true });
  res.json({ account: accountView(user) });
}));

router.post('/kyc', auth, kycFields, requestKYC);

module.exports = router;
