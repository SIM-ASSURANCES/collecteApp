const db = require('../config/db');
const logger = require('../config/logger');

/**
 * Enregistre une action dans le journal d'activités (non-bloquant).
 */
function logActivite({ utilisateur_id, action, entite = null, entite_id = null, details = null, ip = null }) {
  db('journal_activites').insert({
    utilisateur_id: utilisateur_id || null,
    action,
    entite,
    entite_id: entite_id || null,
    details: details ? JSON.stringify(details) : null,
    ip: ip || null,
    created_at: new Date(),
  }).catch(err => logger.warn(`logActivite échoué : ${err.message}`));
}

module.exports = logActivite;
