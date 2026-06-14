const { validationResult } = require('express-validator');
const db = require('../config/db');
const logger = require('../config/logger');

// Date du jour au fuseau de la Côte d'Ivoire (Africa/Abidjan, UTC+0)
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Abidjan' }).format(new Date());

exports.declarer = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { montant_declare, numero_wave } = req.body;
  try {
    // Un seul reversement par jour
    const existant = await db('reversements')
      .where({ commercial_id: req.user.id, date: today() })
      .first();
    if (existant) {
      return res.status(409).json({ message: 'Un reversement a déjà été soumis aujourd\'hui.' });
    }

    // Montant attendu = espèces uniquement (le Wave est déjà encaissé sur le compte SIM)
    const { sum } = await db('paiements')
      .where({ commercial_id: req.user.id, date: today(), mode: 'especes' })
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
        numero_wave: numero_wave || null,
        statut: 'en_attente',
        horodatage: new Date(),
      })
      .returning('*');

    if (ecart > 0) {
      logger.warn(`Reversement partiel #${reversement.id} — écart de ${ecart} FCFA`);
    }
    logger.info(`Reversement #${reversement.id} déclaré par commercial #${req.user.id} (Wave ${numero_wave || '—'})`);
    res.status(201).json(reversement);
  } catch (err) { next(err); }
};

// Créer une session Wave pour régler un reversement (le commercial paie SIM)
exports.creerSessionWaveReversement = async (req, res, next) => {
  try {
    if (!process.env.WAVE_API_KEY) {
      return res.status(503).json({ message: 'Clé API Wave non configurée.', code: 'WAVE_NON_CONFIGURE' });
    }
    const montant = Math.round(Number(req.body.montant));
    if (!montant || montant <= 0) {
      return res.status(400).json({ message: 'Montant invalide.' });
    }
    const waveResp = await fetch('https://api.wave.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(montant),
        currency: 'XOF',
        client_reference: `reversement-${req.user.id}-${today()}`,
        success_url: 'https://collecte.mysimassurances.com/paiement-ok',
        error_url: 'https://collecte.mysimassurances.com/paiement-erreur',
      }),
    });
    const data = await waveResp.json();
    if (!waveResp.ok) {
      logger.error(`Wave reversement ${waveResp.status} : ${JSON.stringify(data)}`);
      return res.status(502).json({ message: 'Erreur API Wave.', detail: data });
    }
    logger.info(`Session Wave reversement ${data.id} — commercial #${req.user.id} (${montant} XOF)`);
    res.status(201).json({ id: data.id, wave_launch_url: data.wave_launch_url, montant });
  } catch (err) { next(err); }
};

// Historique des reversements du commercial connecté
exports.mesReversements = async (req, res, next) => {
  try {
    const reversements = await db('reversements')
      .where({ commercial_id: req.user.id })
      .orderBy('date', 'desc')
      .orderBy('horodatage', 'desc')
      .limit(60);
    res.json(reversements);
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
