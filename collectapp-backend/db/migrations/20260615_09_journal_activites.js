exports.up = async (knex) => {
  await knex.schema.createTable('journal_activites', (table) => {
    table.increments('id');
    table.integer('utilisateur_id').nullable()
      .references('id').inTable('utilisateurs').onDelete('SET NULL');
    table.string('action', 100).notNullable();
    table.string('entite', 50).nullable();
    table.integer('entite_id').nullable();
    table.jsonb('details').nullable();
    table.string('ip', 50).nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('utilisateur_id');
    table.index('action');
    table.index('created_at');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('journal_activites');
};
