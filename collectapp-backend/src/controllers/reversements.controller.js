const { validationResult } = require('express-validator');
const db = require('../config/db');
const logger = require('../config/logger');
const logActivite = require('../utils/logActivite');

// Date du jour au fuseau de la Côte d'Ivoire (Africa/Abidjan, UTC+0)
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Abidjan' }).format(new Date());

// Interroge Wave sur le statut d'une session et met à jour le reversement.
// Renvoie : 'succeeded' | 'processing' | 'failed' | 'non_paye'
async function verifierWave(reversement) {
  if (!reversement.wave_session_id || !process.env.WAVE_API_KEY) {
    return reversement.wave_payment_status || 'non_paye';
  }
  try {
    const resp = await fetch(
      `https://api.wave.com/v1/checkout/sessions/${encodeURIComponent(reversement.wave_session_id)}`,
      { headers: { Authorization: `Bearer ${process.env.WAVE_API_KEY}` } }
    );
    const data = await resp.json();
    if (!resp.ok) {
      logger.warn(`Wave statut reversement #${reversement.id} : HTTP ${resp.status}`);
      return reversement.wave_payment_status || 'processing';
    }
    // payment_status Wave : 'processing' | 'succeeded' | 'cancelled' | 'expired' ...
    let statut;
    if (data.payment_status === 'succeeded') statut = 'succeeded';
    else if (data.payment_status === 'processing') statut = 'processing';
    else statut = 'failed';

    // Délai de grâce : un paiement encore « en cours » 5 min après la tentative
    // est considéré comme échoué → le commercial peut reprendre.
    if (statut === 'processing' && reversement.horodatage) {
      const ageMs = Date.now() - new Date(reversement.horodatage).getTime();
      if (ageMs > 5 * 60 * 1000) statut = 'failed';
    }

    if (statut !== reversement.wave_payment_status) {
      await db('reversements').where({ id: reversement.id }).update({
        wave_payment_status: statut, updated_at: new Date(),
      });
    }
    return statut;
  } catch (err) {
    logger.warn(`Vérification Wave reversement #${reversement.id} échouée : ${err.message}`);
    return reversement.wave_payment_status || 'processing';
  }
}

exports.declarer = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { montant_declare, numero_wave, wave_session_id } = req.body;
  try {
    // Montant attendu = espèces uniquement (le Wave est déjà encaissé sur le compte SIM)
    const { sum } = await db('paiements')
      .where({ commercial_id: req.user.id, date: today(), mode: 'especes' })
      .sum('montant as sum')
      .first();
    const montant_attendu = parseFloat(sum || 0);
    const ecart = montant_attendu - montant_declare;

    const existant = await db('reversements')
      .where({ commercial_id: req.user.id, date: today() })
      .first();

    if (existant) {
      // Bloque si un paiement est déjà confirmé ou validé ; sinon on autorise la reprise
      if (existant.wave_payment_status === 'succeeded' || existant.statut === 'valide') {
        return res.status(409).json({ message: 'Le reversement du jour est déjà payé/validé.' });
      }
      const [maj] = await db('reversements').where({ id: existant.id }).update({
        montant_declare, montant_attendu, ecart,
        numero_wave: numero_wave || null,
        wave_session_id: wave_session_id || null,
        wave_payment_status: 'processing',
        statut: 'en_attente',
        motif_rejet: null,
        horodatage: new Date(), updated_at: new Date(),
      }).returning('*');
      logger.info(`Reversement #${existant.id} repris par commercial #${req.user.id}`);
      return res.status(200).json(maj);
    }

    const [reversement] = await db('reversements')
      .insert({
        commercial_id: req.user.id,
        date: today(),
        montant_declare,
        montant_attendu,
        ecart,
        numero_wave: numero_wave || null,
        wave_session_id: wave_session_id || null,
        wave_payment_status: 'processing',
        statut: 'en_attente',
        horodatage: new Date(),
      })
      .returning('*');

    if (ecart > 0) logger.warn(`Reversement partiel #${reversement.id} — écart de ${ecart} FCFA`);
    logger.info(`Reversement #${reversement.id} déclaré par commercial #${req.user.id}`);
    res.status(201).json(reversement);
  } catch (err) { next(err); }
};

// Le commercial (ou l'admin) rafraîchit le statut de paiement Wave d'un reversement
exports.statutWave = async (req, res, next) => {
  try {
    const r = await db('reversements').where({ id: req.params.id }).first();
    if (!r) return res.status(404).json({ message: 'Reversement introuvable.' });
    if (req.user.role === 'COLLECTEUR' && r.commercial_id !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    const wave_payment_status = await verifierWave(r);
    res.json({ id: r.id, wave_payment_status });
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
    const r = await db('reversements').where({ id: req.params.id }).first();
    if (!r) return res.status(404).json({ message: 'Reversement introuvable.' });

    // L'admin ne peut valider que si Wave a réellement confirmé le paiement
    const statutWave = await verifierWave(r);
    if (statutWave !== 'succeeded') {
      return res.status(409).json({
        message: statutWave === 'failed'
          ? 'Paiement Wave échoué : validation impossible. Le commercial doit reprendre le reversement.'
          : 'Paiement Wave non encore confirmé par Wave. Validation impossible pour le moment.',
        wave_payment_status: statutWave,
        code: 'WAVE_NON_CONFIRME',
      });
    }

    const [maj] = await db('reversements')
      .where({ id: r.id })
      .update({ statut: 'valide', valide_par: req.user.id, valide_le: new Date() })
      .returning('*');
    logger.info(`Reversement #${r.id} validé par admin #${req.user.id} (Wave confirmé)`);
    logActivite({ utilisateur_id: req.user.id, action: 'REVERSEMENT_VALIDE', entite: 'reversement', entite_id: r.id });
    res.json(maj);
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

exports.supprimer = async (req, res, next) => {
  try {
    const n = await db('reversements').where({ id: req.params.id }).del();
    if (!n) return res.status(404).json({ message: 'Reversement introuvable.' });
    logger.info(`Reversement #${req.params.id} supprimé par admin #${req.user.id}`);
    logActivite({ utilisateur_id: req.user.id, action: 'REVERSEMENT_SUPPRIME', entite: 'reversement', entite_id: Number(req.params.id) });
    res.json({ message: 'Reversement supprimé.' });
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
