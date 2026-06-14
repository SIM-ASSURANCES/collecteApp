/**
 * Suivi du paiement Wave d'un reversement :
 *  - wave_session_id      : id de la session Wave Checkout
 *  - wave_payment_status  : non_paye | processing | succeeded | failed
 * L'admin ne peut valider un reversement que si wave_payment_status = succeeded.
 */
exports.up = (knex) =>
  knex.schema.alterTable('reversements', (t) => {
    t.string('wave_session_id').nullable();
    t.string('wave_payment_status').notNullable().defaultTo('non_paye');
  });

exports.down = (knex) =>
  knex.schema.alterTable('reversements', (t) => {
    t.dropColumn('wave_session_id');
    t.dropColumn('wave_payment_status');
  });
