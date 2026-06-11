exports.up = (knex) =>
  knex.schema.createTable('paiements', (t) => {
    t.increments('id').primary();
    t.integer('cotisant_id').unsigned().notNullable().references('id').inTable('cotisants');
    t.integer('commercial_id').unsigned().nullable().references('id').inTable('utilisateurs');
    t.date('date').notNullable();
    t.decimal('montant', 12, 2).notNullable();
    t.enu('mode', ['wave', 'especes', 'cheque', 'autre']).notNullable();
    t.enu('statut', ['paye', 'en_attente', 'annule']).notNullable().defaultTo('paye');
    t.string('reference_wave').nullable();
    t.timestamp('horodatage').notNullable().defaultTo(knex.fn.now());
    t.timestamps(true, true);

    // Contrainte anti-doublon : un seul paiement actif par cotisant par jour
    t.unique(['cotisant_id', 'date']);
  });

exports.down = (knex) => knex.schema.dropTable('paiements');
