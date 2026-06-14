const crypto = require('crypto');
const { validationResult } = require('express-validator');
const db = require('../config/db');
const logger = require('../config/logger');
const sseClients = require('../utils/sseClients');

// Date du jour au fuseau de la Côte d'Ivoire (Africa/Abidjan, UTC+0).
// Le statut « payé » est recalculé chaque jour : un paiement n'est « du jour »
// que si sa date == aujourd'hui, donc tout repasse en impayé à minuit local.
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Abidjan' }).format(new Date());

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
    const cible = await db('cotisants').where({ id: cotisant_id }).first();
    if (!cible) return res.status(404).json({ message: 'Cotisant introuvable.' });
    if (req.user.role === 'COMMERCIAL' && cible.commercial_id !== req.user.id) {
      return res.status(403).json({ message: 'Ce cotisant ne fait pas partie de votre liste.' });
    }

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

// Vérifie la signature HMAC-SHA256 du webhook Wave (en-tête Wave-Signature)
function webhookWaveAutorise(req) {
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  if (!secret) return false; // fail-closed : pas de secret → webhook désactivé
  const header = req.headers['wave-signature'];
  if (!header || !req.rawBody) return false;
  const parts = Object.fromEntries(
    String(header).split(',').map((s) => s.split('=').map((x) => x.trim()))
  );
  const provided = parts.v1;
  if (!provided) return false;
  const signed = `${parts.t || ''}.${req.rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

exports.webhookWave = async (req, res, next) => {
  try {
    if (!webhookWaveAutorise(req)) {
      logger.warn('Webhook Wave rejeté : signature invalide ou secret absent');
      return res.status(401).json({ message: 'Signature invalide.' });
    }
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

// Sommaire des paiements du jour : total espèces (à reverser) + total Wave (déjà encaissé)
exports.todaySommaire = async (req, res, next) => {
  try {
    const base = () => {
      let q = db('paiements').where({ date: today(), statut: 'paye' });
      if (req.user.role === 'COMMERCIAL') q = q.where({ commercial_id: req.user.id });
      return q;
    };

    const [tout]     = await base().count('id as n').sum('montant as s');
    const [especes]  = await base().where('mode', 'especes').count('id as n').sum('montant as s');
    const [wave]     = await base().where('mode', 'wave').count('id as n').sum('montant as s');

    const total_especes = parseFloat(especes.s) || 0;
    res.json({
      date: today(),
      nombre_paiements: parseInt(tout.n, 10) || 0,
      total_encaisse: parseFloat(tout.s) || 0,
      // total_especes = montant physique à reverser ; le Wave va déjà sur le compte SIM
      total_especes,
      nombre_especes: parseInt(especes.n, 10) || 0,
      total_wave: parseFloat(wave.s) || 0,
      nombre_wave: parseInt(wave.n, 10) || 0,
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
    // Un commercial ne peut encaisser que pour ses propres cotisants (anti-IDOR)
    const cible = await db('cotisants').where({ id: cotisant_id }).first();
    if (!cible) return res.status(404).json({ message: 'Cotisant introuvable.' });
    if (req.user.role === 'COMMERCIAL' && cible.commercial_id !== req.user.id) {
      return res.status(403).json({ message: 'Ce cotisant ne fait pas partie de votre liste.' });
    }

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
  const MODES = ['wave', 'especes', 'cheque', 'autre'];
  const resultats = [];
  for (const op of operations) {
    try {
      const cotisant_id = parseInt(op.cotisant_id, 10);
      const montant = parseFloat(op.montant);
      const mode = MODES.includes(op.mode) ? op.mode : 'especes';
      if (!cotisant_id || !(montant > 0)) {
        resultats.push({ ...op, statut: 'erreur', message: 'Données invalides.' });
        continue;
      }

      // Vérifier l'appartenance du cotisant au commercial (anti-IDOR / mass-assignment)
      const cible = await db('cotisants').where({ id: cotisant_id }).first();
      if (!cible || cible.commercial_id !== req.user.id) {
        resultats.push({ ...op, statut: 'erreur', message: 'Cotisant non autorisé.' });
        continue;
      }

      if (await dejaPayeAujourdhui(cotisant_id, op.date)) {
        resultats.push({ ...op, statut: 'doublon' });
        continue;
      }

      // Insertion en liste blanche stricte des champs (jamais ...op)
      const [p] = await db('paiements').insert({
        cotisant_id,
        commercial_id: req.user.id,
        date: today(),
        montant,
        mode,
        statut: 'paye',
        horodatage: new Date(),
      }).returning('id');
      resultats.push({ cotisant_id, statut: 'ok', server_id: p.id });
    } catch (e) {
      resultats.push({ statut: 'erreur', message: e.message });
    }
  }
  res.json({ resultats });
};
