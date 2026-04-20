const File = require('../models/File');

// Uploader un fichier
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const { category, description, isPublic } = req.body;

    const file = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: req.file.path || `/uploads/${req.file.filename}`,
      publicId: req.file.filename,
      user: req.user._id,
      category: category || 'other',
      description,
      isPublic: isPublic === 'true'
    });

    await file.save();

    res.status(201).json({
      message: 'Fichier uploadé avec succès',
      file
    });
  } catch (error) {
    console.error('Erreur upload fichier:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload du fichier' });
  }
};

// Obtenir les fichiers de l'utilisateur
const getUserFiles = async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    
    const filter = { user: req.user._id };
    if (category) filter.category = category;

    const files = await File.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await File.countDocuments(filter);

    res.json({
      files,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur récupération fichiers:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fichiers' });
  }
};

// Télécharger un fichier
const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await File.findOne({
      _id: id,
      $or: [
        { user: req.user._id },
        { isPublic: true }
      ]
    });

    if (!file) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    // Incrémenter le compteur de téléchargements
    file.downloads += 1;
    await file.save();

    // Rediriger vers l'URL ou servir le fichier
    if (file.url.startsWith('http')) {
      res.redirect(file.url);
    } else {
      res.download(file.url);
    }
  } catch (error) {
    console.error('Erreur téléchargement fichier:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement du fichier' });
  }
};

// Supprimer un fichier
const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await File.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!file) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    // Supprimer le fichier physique si nécessaire
    const fs = require('fs');
    const path = require('path');
    if (file.url && !file.url.startsWith('http')) {
      const filePath = path.join(__dirname, '..', file.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ message: 'Fichier supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression fichier:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du fichier' });
  }
};

module.exports = {
  uploadFile,
  getUserFiles,
  downloadFile,
  deleteFile
};