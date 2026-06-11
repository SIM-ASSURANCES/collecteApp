const { validationResult } = require('express-validator');
const db = require('../config/db');
const logger = require('../config/logger');

const today = () => new Date().toISOString().slice(0, 10);

exports.declarer = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { montant_declare } = req.body;
  try {
    // Calcul du montant attendu = somme des paiements manuels du jour
    const { sum } = await db('paiements')
      .where({ commercial_id: req.user.id, date: today() })
      .whereIn('mode', ['especes', 'cheque', 'autre'])
      .sum('montant as sum')
      .first();

    const montant_attendu = parseFloat(sum || 0);
    const ecart = montant_attendu - montant_declare;

    const [reversement] = await db('reversements')
      .insert({
        commercial_id: req.user.id,
        date: today(),
        montant_declare,
        montant_attendu,
        ecart,
        statut: 'en_attente',
        horodatage: new Date(),
      })
      .returning('*');

    if (ecart > 0) {
      logger.warn(`Reversement partiel #${reversement.id} — écart de ${ecart} FCFA`);
    }
    logger.info(`Reversement #${reversement.id} déclaré par commercial #${req.user.id}`);
    res.status(201).json(reversement);
  } catch (err) { next(err); }
};

exports.list = async (req, res, next) => {
  try {
    const { date, statut } = req.query;
    let query = db('reversements').join('utilisateurs', 'reversements.commercial_id', 'utilisateurs.id');
    if (date)   query = query.where('reversements.date', date);
    if (statut) query = query.where('reversements.statut', statut);
    const reversements = await query
      .select('reversements.*', 'utilisateurs.nom as commercial_nom')
      .orderBy('reversements.horodatage', 'desc');
    res.json(reversements);
  } catch (err) { next(err); }
};

exports.valider = async (req, res, next) => {
  try {
    const [r] = await db('reversements')
      .where({ id: req.params.id })
      .update({ statut: 'valide', valide_par: req.user.id, valide_le: new Date() })
      .returning('*');
    if (!r) return res.status(404).json({ message: 'Reversement introuvable.' });
    res.json(r);
  } catch (err) { next(err); }
};

// Récupérer le reversement du jour pour le commercial connecté
exports.todayReversement = async (req, res, next) => {
  try {
    const r = await db('reversements')
      .where({ commercial_id: req.user.id, date: today() })
      .first();
    if (!r) return res.status(404).json({ message: 'Aucun reversement aujourd\'hui.' });
    res.json(r);
  } catch (err) { next(err); }
};

exports.rejeter = async (req, res, next) => {
  try {
    const [r] = await db('reversements')
      .where({ id: req.params.id })
      .update({ statut: 'rejete', motif_rejet: req.body.motif, valide_par: req.user.id })
      .returning('*');
    if (!r) return res.status(404).json({ message: 'Reversement introuvable.' });
    res.json(r);
  } catch (err) { next(err); }
};
