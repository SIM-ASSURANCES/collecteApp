const FREQUENCES = ['journalier', 'hebdomadaire', 'mensuel', 'trimestriel', 'semestriel', 'annuel'];

exports.up = (knex) =>
  knex.schema.alterTable('cotisants', (t) => {
    t.string('frequence_collecte', 20).notNullable().defaultTo('journalier');
  });

exports.down = (knex) =>
  knex.schema.alterTable('cotisants', (t) => {
    t.dropColumn('frequence_collecte');
  });
