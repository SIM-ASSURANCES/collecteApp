/**
 * Reversement par Wave : le commercial charge son compte Wave avec les espèces
 * collectées puis transfère. On enregistre le numéro Wave utilisé.
 */
exports.up = (knex) =>
  knex.schema.alterTable('reversements', (t) => {
    t.string('numero_wave').nullable();
  });

exports.down = (knex) =>
  knex.schema.alterTable('reversements', (t) => {
    t.dropColumn('numero_wave');
  });
