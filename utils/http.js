/** Outils communs aux contrôleurs : erreurs lisibles en JSON. */

function httpError(status, message) {
  const err = new Error(message);
  err.httpStatus = status;
  return err;
}

/** Enveloppe un handler async : renvoie toujours une erreur JSON en français. */
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error.name === 'CastError') error = httpError(404, 'Élément introuvable.');
    if (error.name === 'ValidationError') {
      const first = Object.values(error.errors || {})[0];
      error = httpError(400, (first && first.message) || 'Données invalides.');
    }
    const status = error.httpStatus || 500;
    if (status >= 500) console.error('❌', req.method, req.originalUrl, error);
    if (!res.headersSent) {
      res.status(status).json({
        error: status === 500 ? 'Erreur interne, réessayez dans un instant.' : error.message
      });
    }
  }
};

/** Texte nettoyé et limité, ou chaîne vide. */
function cleanText(value, max = 200) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Texte long (garde les retours à la ligne). */
function cleanLongText(value, max = 2000) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').trim().slice(0, max);
}

/** L'utilisateur a-t-il une identité vérifiée (KYC approuvé) ? */
function isVerified(user) {
  return !!(user && user.verification && user.verification.kycStatus === 'approved');
}

function requireVerified(user) {
  if (!isVerified(user)) {
    throw httpError(403, 'Vérifiez votre identité dans « Mon compte » pour vendre ou proposer des offres.');
  }
}

/** Middleware : refuse avant l'envoi des photos si l'identité n'est pas vérifiée. */
function verifiedOnly(req, res, next) {
  if (isVerified(req.user)) return next();
  res.status(403).json({ error: 'Vérifiez votre identité dans « Mon compte » pour vendre ou proposer des offres.' });
}

module.exports = { httpError, handle, cleanText, cleanLongText, isVerified, requireVerified, verifiedOnly };
