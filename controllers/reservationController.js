const Reservation = require('../models/Reservation');

// Créer une réservation
const createReservation = async (req, res) => {
  try {
    const {
      serviceType,
      serviceName,
      provider,
      date,
      duration,
      participants,
      totalAmount,
      details,
      specialRequests
    } = req.body;

    const reservation = new Reservation({
      user: req.user._id,
      serviceType,
      serviceName,
      provider,
      date: new Date(date),
      duration,
      participants,
      totalAmount,
      details,
      specialRequests,
      status: 'pending'
    });

    await reservation.save();

    res.status(201).json({
      message: 'Réservation créée avec succès',
      reservation
    });
  } catch (error) {
    console.error('Erreur création réservation:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la réservation' });
  }
};

// Obtenir les réservations de l'utilisateur
const getUserReservations = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const reservations = await Reservation.find(filter)
      .populate('provider', 'piUsername profile.avatar')
      .sort({ date: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Reservation.countDocuments(filter);

    res.json({
      reservations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erreur récupération réservations:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des réservations' });
  }
};

// Obtenir une réservation spécifique
const getReservation = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findOne({
      _id: id,
      user: req.user._id
    }).populate('provider', 'piUsername profile.avatar')
      .populate('payment');

    if (!reservation) {
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    res.json({ reservation });
  } catch (error) {
    console.error('Erreur récupération réservation:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la réservation' });
  }
};

// Annuler une réservation
const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const reservation = await Reservation.findOne({
      _id: id,
      user: req.user._id,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Réservation non trouvée ou non annulable' });
    }

    reservation.status = 'cancelled';
    reservation.cancellationReason = reason;
    await reservation.save();

    res.json({ message: 'Réservation annulée avec succès', reservation });
  } catch (error) {
    console.error('Erreur annulation réservation:', error);
    res.status(500).json({ error: 'Erreur lors de l\'annulation de la réservation' });
  }
};

module.exports = {
  createReservation,
  getUserReservations,
  getReservation,
  cancelReservation
};