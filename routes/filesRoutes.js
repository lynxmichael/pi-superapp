const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth } = require('../middlewares/auth');
const {
  uploadFile,
  getUserFiles,
  downloadFile,
  deleteFile
} = require('../controllers/filesController');

// Configuration de multer pour l'upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: function (req, file, cb) {
    // Accepter tous les types de fichiers
    cb(null, true);
  }
});

// Routes
router.post('/upload', auth, upload.single('file'), uploadFile);
router.get('/files', auth, getUserFiles);
router.get('/files/:id/download', auth, downloadFile);
router.delete('/files/:id', auth, deleteFile);

module.exports = router;