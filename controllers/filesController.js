/**
 * Mes fichiers : stockage privé (chacun ne voit que ses fichiers), avec un quota par utilisateur.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const File = require('../models/File');
const { handle, httpError } = require('../utils/http');
const { UPLOADS_DIR } = require('../utils/uploads');

const FILES_DIR = path.join(UPLOADS_DIR, 'files');
fs.mkdirSync(FILES_DIR, { recursive: true });

const MAX_FILE_MB = 10;
const quotaBytes = () => (Number(process.env.FILES_QUOTA_MB) || 100) * 1024 * 1024;

const ALLOWED = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.txt', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.zip', '.mp3', '.mp4']);

const userDir = (userId) => path.join(FILES_DIR, String(userId));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = userDir(req.user._id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex'))
  }),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(path.extname(file.originalname || '').toLowerCase())) return cb(null, true);
    cb(new Error('Type de fichier non accepté (PDF, images, documents Office, texte, ZIP, MP3, MP4).'));
  }
});

function uploadOne(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    res.status(400).json({
      error: err.code === 'LIMIT_FILE_SIZE' ? `Fichier trop lourd (${MAX_FILE_MB} Mo maximum).` : err.message
    });
  });
}

async function usedBytes(userId) {
  const [row] = await File.aggregate([{ $match: { user: userId } }, { $group: { _id: null, total: { $sum: '$size' } } }]);
  return row ? row.total : 0;
}

function publicFile(f) {
  return { id: f._id, name: f.originalName, size: f.size, mimeType: f.mimeType, createdAt: f.createdAt };
}

const listFiles = handle(async (req, res) => {
  const files = await File.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ files: files.map(publicFile), used: await usedBytes(req.user._id), quota: quotaBytes() });
});

const uploadFile = handle(async (req, res) => {
  const file = req.file;
  if (!file) throw httpError(400, 'Choisissez un fichier.');

  const used = await usedBytes(req.user._id);
  if (used + file.size > quotaBytes()) {
    fs.unlink(file.path, () => {});
    throw httpError(400, 'Espace plein : supprimez des fichiers pour en ajouter.');
  }

  const name = path.basename(file.originalname || 'fichier').replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 200);
  const doc = await File.create({
    user: req.user._id,
    originalName: name,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size
  });
  res.status(201).json({ file: publicFile(doc), used: used + file.size, quota: quotaBytes() });
});

const downloadFile = handle(async (req, res) => {
  const doc = await File.findOne({ _id: req.params.id, user: req.user._id });
  if (!doc) throw httpError(404, 'Fichier introuvable.');
  const full = path.join(userDir(req.user._id), path.basename(doc.storedName));
  if (!fs.existsSync(full)) throw httpError(404, 'Fichier introuvable.');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(full, doc.originalName);
});

const deleteFile = handle(async (req, res) => {
  const doc = await File.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!doc) throw httpError(404, 'Fichier introuvable.');
  fs.unlink(path.join(userDir(req.user._id), path.basename(doc.storedName)), () => {});
  res.json({ ok: true, used: await usedBytes(req.user._id), quota: quotaBytes() });
});

module.exports = { uploadOne, listFiles, uploadFile, downloadFile, deleteFile, FILES_DIR };
