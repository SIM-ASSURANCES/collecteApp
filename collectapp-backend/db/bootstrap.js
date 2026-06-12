/**
 * Bootstrap de production : migrations + comptes par défaut.
 * Idempotent — les comptes ne sont créés que si la table est vide,
 * donc aucun risque d'écraser des utilisateurs existants.
 */
const bcrypt = require('bcryptjs');

const env = process.env.NODE_ENV || 'production';
const knex = require('knex')(require('../knexfile')[env]);

(async () => {
  try {
    await knex.migrate.latest();
    console.log('Migrations OK');

    const { n } = await knex('utilisateurs').count('id as n').first();
    if (Number(n) === 0) {
      await knex('utilisateurs').insert([
        {
          nom: 'Administrateur',
          identifiant: 'admin',
          mot_de_passe_hash: await bcrypt.hash('Admin123!', 10),
          role: 'ADMIN',
          actif: true,
        },
        {
          nom: 'Commercial Test',
          identifiant: 'commercial1',
          mot_de_passe_hash: await bcrypt.hash('Test123!', 10),
          role: 'COMMERCIAL',
          actif: true,
        },
      ]);
      console.log('Comptes par défaut créés : admin / commercial1');
    } else {
      console.log(`${n} utilisateur(s) en base — création des comptes ignorée`);
    }

    await knex.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Échec du bootstrap :', err.message);
    process.exit(1);
  }
})();
