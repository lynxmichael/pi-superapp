const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const {
  createReservation,
  getUserReservations,
  getReservation,
  cancelReservation
} = require('../controllers/reservationController');

router.post('/reservations', auth, createReservation);
router.get('/reservations', auth, getUserReservations);
router.get('/reservations/:id', auth, getReservation);
router.post('/reservations/:id/cancel', auth, cancelReservation);

module.exports = router;