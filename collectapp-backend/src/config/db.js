const { types } = require('pg');
const knex = require('knex');
const config = require('../../knexfile');

// Retourner les colonnes date/timestamp comme chaînes ISO plutôt qu'en objets Date JS
// (évite "Mon Jun 15 2026 00:00:00 GMT+0000..." dans les réponses JSON)
types.setTypeParser(1082, str => str);   // date          → 'YYYY-MM-DD'
types.setTypeParser(1114, str => str);   // timestamp     → 'YYYY-MM-DD HH:MM:SS'
types.setTypeParser(1184, str => str);   // timestamptz   → 'YYYY-MM-DD HH:MM:SS+00'

const env = process.env.NODE_ENV || 'development';
const db = knex(config[env]);

db.raw('SELECT 1')
  .then(() => console.log('PostgreSQL connecté'))
  .catch((err) => console.error('Erreur connexion PostgreSQL :', err.message));

module.exports = db;
