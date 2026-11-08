/** Envoi de photos (produits, offres) : dossier public uploads/products. */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const PUBLIC_IMAGES_DIR = path.join(UPLOADS_DIR, 'products');
fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PUBLIC_IMAGES_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${IMAGE_TYPES[file.mimetype]}`)
  }),
  limits: { fileSize: 4 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype]) return cb(null, true);
    cb(new Error('Photos uniquement (JPG, PNG ou WebP).'));
  }
});

/** Middleware : jusqu'à `max` photos dans le champ `field`, erreurs en JSON. */
function photos(field, max) {
  return (req, res, next) => {
    imageUpload.array(field, max)(req, res, (err) => {
      if (!err) return next();
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Photo trop lourde (4 Mo maximum).'
        : err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT' ? `${max} photos maximum.`
          : err.message;
      res.status(400).json({ error: message });
    });
  };
}

const publicUrl = (file) => `/uploads/products/${file.filename}`;

module.exports = { photos, publicUrl, UPLOADS_DIR, PUBLIC_IMAGES_DIR };
