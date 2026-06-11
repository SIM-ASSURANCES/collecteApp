const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Accès refusé : permission insuffisante.' });
  }
  next();
};

module.exports = authorize;
