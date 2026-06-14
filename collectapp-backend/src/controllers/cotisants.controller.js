const { validationResult } = require('express-validator');
const db = require('../config/db');
const logger = require('../config/logger');

exports.list = async (req, res, next) => {
  try {
    const { commercial_id, statut, page = 1, limit = 50 } = req.query;
    let query = db('cotisants').where({});
    // Un commercial ne peut voir que ses propres cotisants
    if (req.user.role === 'COMMERCIAL') {
      query = query.where({ commercial_id: req.user.id });
    } else if (commercial_id) {
      query = query.where({ commercial_id });
    }
    if (statut === 'actif')   query = query.where({ actif: true });
    if (statut === 'inactif') query = query.where({ actif: false });

    const cotisants = await query
      .select('id', 'nom', 'telephone', 'montant_journalier', 'date_inscription', 'commercial_id', 'actif')
      .orderBy('nom')
      .limit(limit)
      .offset((page - 1) * limit);

    res.json(cotisants);
  } catch (err) { next(err); }
};

exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Paramètre de recherche requis.' });
    const results = await db('cotisants')
      .where({ actif: true })
      // Un commercial ne cherche que parmi ses propres cotisants
      .modify((qb) => {
        if (req.user.role === 'COMMERCIAL') qb.where({ commercial_id: req.user.id });
      })
      .andWhere((qb) => {
        qb.where('nom', 'ilike', `%${q}%`).orWhere('telephone', 'ilike', `%${q}%`);
      })
      .select('id', 'nom', 'telephone', 'montant_journalier', 'commercial_id');
    res.json(results);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const cotisant = await db('cotisants').where({ id: req.params.id }).first();
    if (!cotisant) return res.status(404).json({ message: 'Cotisant introuvable.' });
    // Un commercial ne consulte que ses propres cotisants (anti-IDOR)
    if (req.user.role === 'COMMERCIAL' && cotisant.commercial_id !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    res.json(cotisant);
  } catch (err) { next(err); }
};

// Date du jour au fuseau de la Côte d'Ivoire (Africa/Abidjan, UTC+0)
const todayCI = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Abidjan' }).format(new Date());

const toDateStr = (d) =>
  (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

// Historique de paiements d'un cotisant + jours impayés (dates manquées)
exports.historique = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cotisant = await db('cotisants').where({ id }).first();
    if (!cotisant) return res.status(404).json({ message: 'Cotisant introuvable.' });

    // Un commercial ne consulte que ses propres cotisants
    if (req.user.role === 'COMMERCIAL' && cotisant.commercial_id !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    const paiements = await db('paiements')
      .where({ cotisant_id: id })
      .whereNot('statut', 'annule')
      .orderBy('date', 'desc')
      .orderBy('horodatage', 'desc')
      .select('id', 'date', 'montant', 'mode', 'statut', 'horodatage', 'reference_wave');

    const datesPayees = new Set(paiements.map((p) => toDateStr(p.date)));

    // Jours manqués : du lendemain de l'inscription jusqu'à hier (aujourd'hui non échu)
    const todayStr = todayCI();
    const today = new Date(todayStr + 'T00:00:00Z');
    let cur = new Date(toDateStr(cotisant.date_inscription) + 'T00:00:00Z');

    const joursManques = [];
    let garde = 0;
    while (cur < today && garde < 1000) {
      const ds = cur.toISOString().slice(0, 10);
      if (!datesPayees.has(ds)) joursManques.push(ds);
      cur.setUTCDate(cur.getUTCDate() + 1);
      garde++;
    }

    const totalPaye = paiements
      .filter((p) => p.statut === 'paye')
      .reduce((s, p) => s + Number(p.montant), 0);

    res.json({
      cotisant: {
        id: cotisant.id,
        nom: cotisant.nom,
        telephone: cotisant.telephone,
        montant_journalier: cotisant.montant_journalier,
        date_inscription: cotisant.date_inscription,
      },
      paiements,
      nombre_paiements: paiements.length,
      total_paye: totalPaye,
      jours_manques: joursManques.reverse(), // plus récents en premier
      nombre_jours_manques: joursManques.length,
      paye_aujourd_hui: datesPayees.has(todayStr),
    });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { nom, telephone, montant_journalier, commercial_id } = req.body;
  try {
    const existe = await db('cotisants').where({ telephone }).first();
    if (existe) {
      return res.status(409).json({ message: `Le numéro ${telephone} est déjà enregistré.` });
    }
    const [cotisant] = await db('cotisants')
      .insert({ nom, telephone, montant_journalier, commercial_id, date_inscription: new Date() })
      .returning('*');
    logger.info(`Cotisant créé #${cotisant.id} par admin #${req.user.id}`);
    res.status(201).json(cotisant);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { nom, telephone, montant_journalier, commercial_id } = req.body;
    const [cotisant] = await db('cotisants')
      .where({ id: req.params.id })
      .update({ nom, telephone, montant_journalier, commercial_id, updated_at: new Date() })
      .returning('*');
    if (!cotisant) return res.status(404).json({ message: 'Cotisant introuvable.' });
    res.json(cotisant);
  } catch (err) { next(err); }
};

exports.desactiver = async (req, res, next) => {
  try {
    const [cotisant] = await db('cotisants')
      .where({ id: req.params.id })
      .update({ actif: false, updated_at: new Date() })
      .returning('*');
    if (!cotisant) return res.status(404).json({ message: 'Cotisant introuvable.' });
    logger.info(`Cotisant #${cotisant.id} désactivé par admin #${req.user.id}`);
    res.json({ message: 'Cotisant désactivé.', cotisant });
  } catch (err) { next(err); }
};
