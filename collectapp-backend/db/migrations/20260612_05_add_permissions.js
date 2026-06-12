/**
 * Ajoute la gestion fine des accès :
 *  - colonne permissions (jsonb) : liste des pages autorisées
 *  - rôle SUPERVISEUR : accès à l'espace admin limité par permissions
 */
exports.up = async (knex) => {
  await knex.schema.alterTable('utilisateurs', (t) => {
    t.jsonb('permissions').notNullable().defaultTo('[]');
  });
  await knex.raw('ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check');
  await knex.raw(
    "ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_check CHECK (role IN ('ADMIN','SUPERVISEUR','COMMERCIAL'))"
  );
};

exports.down = async (knex) => {
  await knex.schema.alterTable('utilisateurs', (t) => {
    t.dropColumn('permissions');
  });
  await knex.raw('ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check');
  await knex.raw(
    "ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_check CHECK (role IN ('ADMIN','COMMERCIAL'))"
  );
};
