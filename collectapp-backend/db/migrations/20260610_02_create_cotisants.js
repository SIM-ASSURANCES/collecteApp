exports.up = (knex) =>
  knex.schema.createTable('cotisants', (t) => {
    t.increments('id').primary();
    t.string('nom').notNullable();
    t.string('telephone').notNullable().unique();
    t.decimal('montant_journalier', 12, 2).notNullable();
    t.date('date_inscription').notNullable().defaultTo(knex.fn.now());
    t.integer('commercial_id').unsigned().references('id').inTable('utilisateurs').onDelete('SET NULL');
    t.boolean('actif').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTable('cotisants');
