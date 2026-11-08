const mongoose = require('mongoose');

/** Fichier privé d'un utilisateur, rangé dans uploads/files/<id utilisateur>/ (jamais servi publiquement). */
const fileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true, maxlength: 200 },
  storedName: { type: String, required: true },
  mimeType: String,
  size: { type: Number, required: true, min: 0 }
}, {
  timestamps: true,
  collection: 'user_files'
});

module.exports = mongoose.model('File', fileSchema);
