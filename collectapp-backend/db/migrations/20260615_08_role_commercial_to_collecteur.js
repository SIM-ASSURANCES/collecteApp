/**
 * Renomme le rôle COMMERCIAL → COLLECTEUR dans la table utilisateurs.
 */
exports.up = async (knex) => {
  await knex.raw('ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check');
  await knex('utilisateurs').where({ role: 'COMMERCIAL' }).update({ role: 'COLLECTEUR' });
  await knex.raw(
    "ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_check CHECK (role IN ('ADMIN','SUPERVISEUR','COLLECTEUR'))"
  );
  await knex.raw("ALTER TABLE utilisateurs ALTER COLUMN role SET DEFAULT 'COLLECTEUR'");
};

exports.down = async (knex) => {
  await knex.raw('ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check');
  await knex('utilisateurs').where({ role: 'COLLECTEUR' }).update({ role: 'COMMERCIAL' });
  await knex.raw(
    "ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_check CHECK (role IN ('ADMIN','SUPERVISEUR','COMMERCIAL'))"
  );
  await knex.raw("ALTER TABLE utilisateurs ALTER COLUMN role SET DEFAULT 'COMMERCIAL'");
};
