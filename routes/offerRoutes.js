const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middlewares/auth');
const o = require('../controllers/offerController');
const { photos } = require('../utils/uploads');
const { verifiedOnly } = require('../utils/http');

// Réservations et abonnements du client ou du commerçant (avant /:id)
router.get('/bookings', auth, o.listBookings);
router.post('/bookings/:id/accept', auth, o.acceptBooking);
router.post('/bookings/:id/refuse', auth, o.refuseBooking);
router.post('/bookings/:id/cancel', auth, o.cancelBooking);
router.get('/memberships', auth, o.listMemberships);
router.get('/mine', auth, o.myOffers);

// Offres
router.get('/', o.listOffers);
router.get('/:id', optionalAuth, o.getOffer);
router.post('/', auth, verifiedOnly, photos('image', 1), o.createOffer);
router.put('/:id', auth, photos('image', 1), o.updateOffer);
router.delete('/:id', auth, o.deleteOffer);
router.post('/:id/book', auth, o.bookOffer);
router.post('/:id/subscribe', auth, o.subscribe);

module.exports = router;
