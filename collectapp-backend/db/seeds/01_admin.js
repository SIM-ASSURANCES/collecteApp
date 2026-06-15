const bcrypt = require('bcryptjs');

exports.seed = async (knex) => {
  await knex('utilisateurs').del();
  await knex('utilisateurs').insert([
    {
      nom: 'Administrateur',
      identifiant: 'admin',
      mot_de_passe_hash: await bcrypt.hash('Admin123!', 10),
      role: 'ADMIN',
      actif: true,
    },
    {
      nom: 'Collecteur Test',
      identifiant: 'collecteur1',
      mot_de_passe_hash: await bcrypt.hash('Test123!', 10),
      role: 'COLLECTEUR',
      actif: true,
    },
  ]);
};
