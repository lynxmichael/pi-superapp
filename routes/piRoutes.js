const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const isAdmin = require('../middlewares/isAdmin');
const pi = require('../controllers/piController');

// Public
router.get('/config', pi.getConfig);
router.post('/auth', pi.authenticate);

// Utilisateur connecté
router.get('/me', auth, pi.getMe);
router.get('/operations', auth, pi.listOperations);

router.post('/deposits/approve', auth, pi.approveDeposit);
router.post('/deposits/complete', auth, pi.completeDeposit);
router.post('/deposits/cancel', auth, pi.cancelDeposit);
router.post('/deposits/incomplete', auth, pi.resolveIncompleteDeposit);

router.post('/withdrawals', auth, pi.requestWithdrawal);

// Admin
router.get('/admin/summary', auth, isAdmin, pi.adminSummary);
router.get('/admin/withdrawals', auth, isAdmin, pi.adminListWithdrawals);
router.post('/admin/withdrawals/:id/approve', auth, isAdmin, pi.adminApproveWithdrawal);
router.post('/admin/withdrawals/:id/reject', auth, isAdmin, pi.adminRejectWithdrawal);

module.exports = router;
