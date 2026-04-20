const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const isAdmin = require('../middlewares/isAdmin');
const User = require('../models/User');
const {
  getKYCDetail,
  approveKYC,
  rejectKYC,
  getPendingKYC
} = require('../controllers/usersController');

// ============================================================================
// Toutes les routes admin nécessitent auth + isAdmin
// ============================================================================

// GET /api/admin/users - Liste des utilisateurs avec filtres et pagination
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      kyc
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const filter = {};

    if (search) {
      filter.$or = [
        { piUsername: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { piUid: { $regex: search, $options: 'i' } },
        { walletAddress: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ];
    }

    if (role) filter.role = role;
    if (status) filter.status = status;
    if (kyc) filter['verification.kycStatus'] = kyc;

    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select('-security.loginPin -security.twoFactorSecret')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const [totalUsers, activeUsers, suspendedUsers, pendingKYC] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ 'verification.kycStatus': 'pending' })
    ]);

    res.json({
      users,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      stats: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        pendingKYC
      }
    });

  } catch (error) {
    console.error('Erreur liste utilisateurs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// GET /api/admin/users/:id - Détail d'un utilisateur
router.get('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-security.loginPin -security.twoFactorSecret')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(user);

  } catch (error) {
    console.error('Erreur détail utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'utilisateur' });
  }
});

// PUT /api/admin/users/:id - Modifier un utilisateur
router.put('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    const allowedUpdates = [
      'piUsername', 'email', 'role', 'status', 'balance',
      'verification.kycStatus', 'phone'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (req.params.id === req.user._id.toString() && updates.role && updates.role !== 'admin') {
      return res.status(400).json({ error: 'Vous ne pouvez pas retirer vos propres droits d\'administrateur' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-security.loginPin');

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ message: 'Utilisateur mis à jour avec succès', user });

  } catch (error) {
    console.error('Erreur modification utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// PUT /api/admin/users/:id/status - Changer le statut
router.put('/users/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    if (req.params.id === req.user._id.toString() && status !== 'active') {
      return res.status(400).json({ error: 'Vous ne pouvez pas suspendre votre propre compte' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-security.loginPin');

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      message: `Utilisateur ${status === 'active' ? 'activé' : 'suspendu'} avec succès`,
      user
    });

  } catch (error) {
    console.error('Erreur changement statut:', error);
    res.status(500).json({ error: 'Erreur lors du changement de statut' });
  }
});

// DELETE /api/admin/users/:id - Supprimer un utilisateur
router.delete('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ message: 'Utilisateur supprimé avec succès' });

  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ============================================================================
// ROUTES KYC ADMIN
// ============================================================================

// GET /api/admin/kyc/pending - Liste des demandes KYC en attente
router.get('/kyc/pending', auth, isAdmin, getPendingKYC);

// GET /api/admin/kyc/:id - Détail complet du KYC d'un utilisateur
router.get('/kyc/:id', auth, isAdmin, getKYCDetail);

// PUT /api/admin/kyc/:id/approve - Approuver un KYC
router.put('/kyc/:id/approve', auth, isAdmin, approveKYC);

// PUT /api/admin/kyc/:id/reject - Rejeter un KYC
router.put('/kyc/:id/reject', auth, isAdmin, rejectKYC);

module.exports = router;