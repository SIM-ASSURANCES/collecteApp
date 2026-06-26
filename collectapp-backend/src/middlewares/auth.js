const jwt = require('jsonwebtoken');
const { isRevoked } = require('../utils/tokenBlacklist');

const auth = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide.' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Rejeter les tokens révoqués (déconnexion explicite)
    if (payload.jti && isRevoked(payload.jti)) {
      return res.status(401).json({ message: 'Token révoqué. Reconnectez-vous.' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Token expiré ou invalide.' });
  }
};

module.exports = auth;
