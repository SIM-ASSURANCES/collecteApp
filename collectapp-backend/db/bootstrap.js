/**
 * Bootstrap de production : migrations + compte administrateur garanti.
 *
 * À chaque démarrage :
 *  - exécute les migrations
 *  - garantit l'existence d'un compte ADMIN actif avec les identifiants
 *    fournis par ADMIN_IDENTIFIANT / ADMIN_PASSWORD (défaut : admin / Admin123).
 *    Le mot de passe est (re)appliqué au démarrage → accès admin toujours valide.
 *  - crée le commercial de test seulement si la table est vide (jamais réécrit).
 */
const bcrypt = require('bcryptjs');

const env = process.env.NODE_ENV || 'production';
const knex = require('knex')(require('../knexfile')[env]);

const ADMIN_ID  = process.env.ADMIN_IDENTIFIANT || 'admin';
const ADMIN_PWD = process.env.ADMIN_PASSWORD    || 'Admin123';
const ADMIN_NOM = process.env.ADMIN_NOM         || 'Administrateur';

(async () => {
  try {
    await knex.migrate.latest();
    console.log('Migrations OK');

    const hash = await bcrypt.hash(ADMIN_PWD, 10);
    const existant = await knex('utilisateurs').where({ identifiant: ADMIN_ID }).first();

    if (existant) {
      // Réapplique les accès admin (mot de passe, rôle, actif, déverrouillage)
      await knex('utilisateurs').where({ id: existant.id }).update({
        mot_de_passe_hash: hash,
        role: 'ADMIN',
        actif: true,
        tentatives_connexion: 0,
        locked_until: null,
        updated_at: new Date(),
      });
      console.log(`Compte admin "${ADMIN_ID}" mis à jour (accès garantis).`);
    } else {
      await knex('utilisateurs').insert({
        nom: ADMIN_NOM,
        identifiant: ADMIN_ID,
        mot_de_passe_hash: hash,
        role: 'ADMIN',
        actif: true,
      });
      console.log(`Compte admin "${ADMIN_ID}" créé.`);
    }

    // Commercial de test : uniquement si la base ne contient encore aucun commercial
    const { n } = await knex('utilisateurs').where({ role: 'COMMERCIAL' }).count('id as n').first();
    if (Number(n) === 0) {
      await knex('utilisateurs').insert({
        nom: 'Commercial Test',
        identifiant: 'commercial1',
        mot_de_passe_hash: await bcrypt.hash('Test123!', 10),
        role: 'COMMERCIAL',
        actif: true,
      });
      console.log('Commercial de test "commercial1" créé.');
    }

    await knex.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Échec du bootstrap :', err.message);
    process.exit(1);
  }
})();
