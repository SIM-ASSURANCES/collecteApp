const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.url} — ${err.message}`);

  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Une erreur interne est survenue.'
      : err.message;

  res.status(status).json({ message });
};

module.exports = errorHandler;
