exports.up = (knex) =>
  knex.schema.createTable('utilisateurs', (t) => {
    t.increments('id').primary();
    t.string('nom').notNullable();
    t.string('identifiant').notNullable().unique();
    t.string('mot_de_passe_hash').notNullable();
    t.enu('role', ['ADMIN', 'COMMERCIAL']).notNullable().defaultTo('COMMERCIAL');
    t.boolean('actif').notNullable().defaultTo(true);
    t.integer('tentatives_connexion').defaultTo(0);
    t.timestamp('locked_until').nullable();
    t.timestamp('derniere_connexion').nullable();
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTable('utilisateurs');
