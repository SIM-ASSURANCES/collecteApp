exports.up = (knex) =>
  knex.schema.createTable('reversements', (t) => {
    t.increments('id').primary();
    t.integer('commercial_id').unsigned().notNullable().references('id').inTable('utilisateurs');
    t.date('date').notNullable();
    t.decimal('montant_declare', 12, 2).notNullable();
    t.decimal('montant_attendu', 12, 2).notNullable();
    t.decimal('ecart', 12, 2).notNullable().defaultTo(0);
    t.enu('statut', ['en_attente', 'valide', 'rejete']).notNullable().defaultTo('en_attente');
    t.string('motif_rejet').nullable();
    t.integer('valide_par').unsigned().nullable().references('id').inTable('utilisateurs');
    t.timestamp('valide_le').nullable();
    t.timestamp('horodatage').notNullable().defaultTo(knex.fn.now());
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTable('reversements');
