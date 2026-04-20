/**
 * 🛡️ Vérification rôle administrateur
 * À utiliser APRÈS auth : router.get('/route', auth, isAdmin, handler)
 */
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Accès réservé aux administrateurs'
    });
  }
  next();
};

module.exports = isAdmin;