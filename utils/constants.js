module.exports = {
  // Statuts des paiements
  PAYMENT_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed'
  },

  // Types de services
  SERVICE_TYPES: {
    MARKETPLACE: 'marketplace',
    ECOMMERCE: 'ecommerce',
    RECHARGE: 'recharge',
    SUBSCRIPTION: 'subscription',
    GAME: 'game',
    RESERVATION: 'reservation',
    TRANSFER: 'transfer',
    OTHER: 'other'
  },

  // Catégories de produits
  PRODUCT_CATEGORIES: [
    'electronics',
    'fashion',
    'home',
    'sports',
    'books',
    'digital',
    'services',
    'other'
  ],

  // Cycles de facturation
  BILLING_CYCLES: [
    'daily',
    'weekly',
    'monthly',
    'yearly'
  ],

  // Types de recharge
  RECHARGE_TYPES: [
    'mobile',
    'electricity',
    'water',
    'internet',
    'tv',
    'other'
  ],

  // Types de réservation
  RESERVATION_TYPES: [
    'hotel',
    'restaurant',
    'transport',
    'event',
    'other'
  ],

  // Catégories de jeux
  GAME_CATEGORIES: [
    'arcade',
    'puzzle',
    'strategy',
    'casino',
    'other'
  ]
};