const knex = require('knex');
const config = require('../../knexfile');

const env = process.env.NODE_ENV || 'development';
const db = knex(config[env]);

db.raw('SELECT 1')
  .then(() => console.log('PostgreSQL connecté'))
  .catch((err) => console.error('Erreur connexion PostgreSQL :', err.message));

module.exports = db;
