const { validationResult } = require('express-validator');
const db = require('../config/db');
const logger = require('../config/logger');
const sseClients = require('../utils/sseClients');

const today = () => new Date().toISOString().slice(0, 10);

// Vérification anti-doublon
async function dejaPayeAujourdhui(cotisant_id, date = today()) {
  const paiement = await db('paiements')
    .where({ cotisant_id, date })
    .where('statut', '!=', 'annule')
    .first();
  return !!paiement;
}

exports.enregistrerManuel = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { cotisant_id, montant, mode } = req.body;
  try {
    if (await dejaPayeAujourdhui(cotisant_id)) {
      return res.status(409).json({
        message: 'Ce cotisant a déjà payé aujourd\'hui. Confirmez-vous un second paiement ?',
        code: 'DOUBLON_PAIEMENT',
      });
    }
    const [paiement] = await db('paiements')
      .insert({
        cotisant_id,
        commercial_id: req.user.id,
        date: today(),
        montant,
        mode,
        statut: 'paye',
        horodatage: new Date(),
      })
      .returning('*');

    logger.info(`Paiement manuel #${paiement.id} — cotisant #${cotisant_id}`);
    sseClients.broadcast({ type: 'PAIEMENT_NOUVEAU', paiement });
    res.status(201).json(paiement);
  } catch (err) { next(err); }
};

// ── Wave Checkout API ──
const WAVE_API = 'https://api.wave.com/v1/checkout/sessions';

// Créer une session de paiement Wave → retourne l'URL à encoder en QR
exports.creerSessionWave = async (req, res, next) => {
  try {
    if (!process.env.WAVE_API_KEY) {
      return res.status(503).json({ message: 'Clé API Wave non configurée.', code: 'WAVE_NON_CONFIGURE' });
    }
    const { cotisant_id } = req.body;
    const cotisant = await db('cotisants').where({ id: cotisant_id, actif: true }).first();
    if (!cotisant) return res.status(404).json({ message: 'Cotisant introuvable.' });

    const montant = Math.round(Number(cotisant.montant_journalier));
    const waveResp = await fetch(WAVE_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(montant),
        currency: 'XOF',
        client_reference: `cotisant-${cotisant.id}-${today()}`,
        success_url: 'https://collecte.mysimassurances.com/paiement-ok',
        error_url: 'https://collecte.mysimassurances.com/paiement-erreur',
      }),
    });
    const data = await waveResp.json();
    if (!waveResp.ok) {
      logger.error(`Wave API ${waveResp.status} : ${JSON.stringify(data)}`);
      return res.status(502).json({ message: 'Erreur API Wave.', detail: data });
    }
    logger.info(`Session Wave ${data.id} créée — cotisant #${cotisant.id} (${montant} XOF)`);
    res.status(201).json({ id: data.id, wave_launch_url: data.wave_launch_url, montant });
  } catch (err) { next(err); }
};

// Vérifier le statut d'une session Wave (succeeded / processing / cancelled)
exports.statutSessionWave = async (req, res, next) => {
  try {
    if (!process.env.WAVE_API_KEY) {
      return res.status(503).json({ message: 'Clé API Wave non configurée.', code: 'WAVE_NON_CONFIGURE' });
    }
    const waveResp = await fetch(`${WAVE_API}/${encodeURIComponent(req.params.id)}`, {
      headers: { Authorization: `Bearer ${process.env.WAVE_API_KEY}` },
    });
    const data = await waveResp.json();
    if (!waveResp.ok) {
      return res.status(502).json({ message: 'Erreur API Wave.', detail: data });
    }
    res.json({ id: data.id, checkout_status: data.checkout_status, payment_status: data.payment_status });
  } catch (err) { next(err); }
};

exports.webhookWave = async (req, res, next) => {
  try {
    const { telephone, montant, reference } = req.body;

    const cotisant = await db('cotisants').where({ telephone, actif: true }).first();
    if (!cotisant) {
      logger.warn(`Wave webhook — numéro inconnu : ${telephone}`);
      sseClients.broadcast({ type: 'WAVE_INCONNU', telephone });
      return res.status(200).json({ message: 'Numéro non enregistré, paiement ignoré.' });
    }

    if (await dejaPayeAujourdhui(cotisant.id)) {
      logger.warn(`Wave webhook — doublon détecté cotisant #${cotisant.id}`);
      sseClients.broadcast({ type: 'WAVE_DOUBLON', cotisant_id: cotisant.id });
      return res.status(200).json({ message: 'Doublon détecté, paiement ignoré.' });
    }

    const [paiement] = await db('paiements')
      .insert({
        cotisant_id: cotisant.id,
        commercial_id: null,
        date: today(),
        montant,
        mode: 'wave',
        statut: 'paye',
        reference_wave: reference,
        horodatage: new Date(),
      })
      .returning('*');

    logger.info(`Paiement Wave #${paiement.id} — cotisant #${cotisant.id}`);
    sseClients.broadcast({ type: 'PAIEMENT_NOUVEAU', paiement });
    res.status(200).json({ message: 'Paiement enregistré.' });
  } catch (err) { next(err); }
};

exports.today = async (req, res, next) => {
  try {
    let query = db('paiements').where('paiements.date', today());
    if (req.user.role === 'COMMERCIAL') query = query.where('paiements.commercial_id', req.user.id);
    const paiements = await query
      .join('cotisants', 'paiements.cotisant_id', 'cotisants.id')
      .select('paiements.*', 'cotisants.nom as cotisant_nom', 'cotisants.telephone');
    res.json(paiements);
  } catch (err) { next(err); }
};

// Sommaire des paiements du jour pour un commercial (montant total + nombre)
exports.todaySommaire = async (req, res, next) => {
  try {
    let query = db('paiements').where({ date: today(), statut: 'paye' });
    if (req.user.role === 'COMMERCIAL') query = query.where({ commercial_id: req.user.id });
    const [row] = await query.count('id as nombre_paiements').sum('montant as total_encaisse');
    res.json({
      date: today(),
      nombre_paiements: parseInt(row.nombre_paiements, 10) || 0,
      total_encaisse: parseFloat(row.total_encaisse) || 0,
    });
  } catch (err) { next(err); }
};

// Enregistrement paiement (Wave ou Manuel) depuis l'espace commercial
exports.enregistrer = async (req, res, next) => {
  const { cotisant_id, montant, mode, statut = 'paye', reference_wave } = req.body;
  if (!cotisant_id || !montant || !mode) {
    return res.status(400).json({ message: 'cotisant_id, montant et mode sont obligatoires.' });
  }
  try {
    if (await dejaPayeAujourdhui(cotisant_id)) {
      return res.status(409).json({
        message: 'Ce cotisant a déjà payé aujourd\'hui.',
        code: 'DOUBLON_PAIEMENT',
      });
    }
    const [paiement] = await db('paiements')
      .insert({
        cotisant_id,
        commercial_id: req.user.id,
        date: today(),
        montant,
        mode,
        statut,
        reference_wave: reference_wave || null,
        horodatage: new Date(),
      })
      .returning('*');

    logger.info(`Paiement #${paiement.id} [${mode}] — cotisant #${cotisant_id} par commercial #${req.user.id}`);
    sseClients.broadcast({ type: 'PAIEMENT_NOUVEAU', paiement });
    res.status(201).json(paiement);
  } catch (err) { next(err); }
};

exports.historiqueCotisant = async (req, res, next) => {
  try {
    const paiements = await db('paiements')
      .where({ cotisant_id: req.params.id })
      .orderBy('date', 'desc');
    res.json(paiements);
  } catch (err) { next(err); }
};

exports.syncOffline = async (req, res, next) => {
  const { operations } = req.body;
  if (!Array.isArray(operations)) {
    return res.status(400).json({ message: 'Format invalide.' });
  }
  const resultats = [];
  for (const op of operations) {
    try {
      if (await dejaPayeAujourdhui(op.cotisant_id, op.date)) {
        resultats.push({ ...op, statut: 'doublon' });
        continue;
      }
      const [p] = await db('paiements').insert({ ...op, commercial_id: req.user.id }).returning('id');
      resultats.push({ ...op, statut: 'ok', server_id: p.id });
    } catch (e) {
      resultats.push({ ...op, statut: 'erreur', message: e.message });
    }
  }
  res.json({ resultats });
};
