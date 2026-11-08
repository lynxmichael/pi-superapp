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
// TOUTES LES ROUTES NÉCESSITENT AUTH + ISADMIN
// ============================================================================

// ---- UTILISATEURS ----

// GET /api/admin/users
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, status, kyc } = req.query;
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
      users, total, page: pageNum,
      pages: Math.ceil(total / limitNum),
      stats: { totalUsers, activeUsers, suspendedUsers, pendingKYC }
    });
  } catch (error) {
    console.error('Erreur liste utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-security.loginPin -security.twoFactorSecret')
      .lean();
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    const allowedUpdates = ['email', 'phone', 'role', 'status', 'verification.kycStatus'];
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) updates[key] = req.body[key];
    });

    if (req.params.id === req.user._id.toString() && updates.role && updates.role !== 'admin') {
      return res.status(400).json({ error: 'Impossible de retirer vos droits admin' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true })
      .select('-security.loginPin');
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    res.json({ message: 'Utilisateur mis à jour', user });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }
    if (req.params.id === req.user._id.toString() && status !== 'active') {
      return res.status(400).json({ error: 'Impossible de suspendre votre propre compte' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .select('-security.loginPin');
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    res.json({ message: `Utilisateur ${status === 'active' ? 'activé' : 'suspendu'}`, user });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---- WALLET BLOCK/UNBLOCK ----

// PUT /api/admin/users/:id/wallet
router.put('/users/:id/wallet', auth, isAdmin, async (req, res) => {
  try {
    const { walletBlocked } = req.body;
    
    if (typeof walletBlocked !== 'boolean') {
      return res.status(400).json({ error: 'Paramètre walletBlocked requis (true/false)' });
    }

    const update = walletBlocked
      ? { status: 'suspended', 'security.walletBlocked': true, 'security.walletBlockedAt': new Date(), 'security.walletBlockedBy': req.user._id }
      : { 'security.walletBlocked': false, 'security.walletUnblockedAt': new Date() };

    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
      .select('piUsername walletAddress status security.walletBlocked');

    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const action = walletBlocked ? 'bloqué' : 'débloqué';
    console.log(`🔒 Wallet ${action} pour ${user.piUsername} par admin ${req.user.piUsername}`);

    res.json({ message: `Wallet ${action} avec succès`, user });
  } catch (error) {
    console.error('Erreur wallet:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---- KYC ADMIN ----

// GET /api/admin/kyc/pending
router.get('/kyc/pending', auth, isAdmin, getPendingKYC);

// GET /api/admin/kyc/:id
router.get('/kyc/:id', auth, isAdmin, getKYCDetail);

// PUT /api/admin/kyc/:id/approve
router.put('/kyc/:id/approve', auth, isAdmin, approveKYC);

// PUT /api/admin/kyc/:id/reject
router.put('/kyc/:id/reject', auth, isAdmin, rejectKYC);

module.exports = router;