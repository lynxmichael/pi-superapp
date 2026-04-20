const { validationResult } = require('express-validator');

// Middleware de validation des résultats
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Données invalides',
      details: errors.array()
    });
  }
  next();
};

// Règles de validation pour l'inscription
const validateRegistration = [
  // Exemple de validation avec express-validator
  // Ces règles doivent être adaptées selon les besoins
];

module.exports = {
  handleValidationErrors,
  validateRegistration
};