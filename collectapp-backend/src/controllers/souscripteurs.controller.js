const { validationResult } = require('express-validator');
const db = require('../config/db');
const logger = require('../config/logger');
const logActivite = require('../utils/logActivite');

exports.list = async (req, res, next) => {
  try {
    const { commercial_id, statut, page = 1, limit = 50 } = req.query;
    let query = db('cotisants').where({});
    if (req.user.role === 'COLLECTEUR') {
      query = query.where({ commercial_id: req.user.id });
    } else if (commercial_id) {
      query = query.where({ commercial_id });
    }
    if (statut === 'actif')   query = query.where({ actif: true });
    if (statut === 'inactif') query = query.where({ actif: false });

    const souscripteurs = await query
      .select('id', 'nom', 'telephone', 'montant_journalier', 'frequence_collecte', 'date_inscription', 'commercial_id', 'actif')
      .orderBy('nom')
      .limit(limit)
      .offset((page - 1) * limit);

    res.json(souscripteurs);
  } catch (err) { next(err); }
};

exports.search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Paramètre de recherche requis.' });
    const results = await db('cotisants')
      .where({ actif: true })
      .modify((qb) => {
        if (req.user.role === 'COLLECTEUR') qb.where({ commercial_id: req.user.id });
      })
      .andWhere((qb) => {
        qb.where('nom', 'ilike', `%${q}%`).orWhere('telephone', 'ilike', `%${q}%`);
      })
      .select('id', 'nom', 'telephone', 'montant_journalier', 'frequence_collecte', 'commercial_id');
    res.json(results);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const souscripteur = await db('cotisants').where({ id: req.params.id }).first();
    if (!souscripteur) return res.status(404).json({ message: 'Souscripteur introuvable.' });
    if (req.user.role === 'COLLECTEUR' && souscripteur.commercial_id !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    res.json(souscripteur);
  } catch (err) { next(err); }
};

const todayCI = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Abidjan' }).format(new Date());

const toDateStr = (d) =>
  (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

exports.historique = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const souscripteur = await db('cotisants').where({ id }).first();
    if (!souscripteur) return res.status(404).json({ message: 'Souscripteur introuvable.' });

    if (req.user.role === 'COLLECTEUR' && souscripteur.commercial_id !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    const paiements = await db('paiements')
      .where({ cotisant_id: id })
      .whereNot('statut', 'annule')
      .orderBy('date', 'desc')
      .orderBy('horodatage', 'desc')
      .select('id', 'date', 'montant', 'mode', 'statut', 'horodatage', 'reference_wave');

    const datesPayees = new Set(paiements.map((p) => toDateStr(p.date)));

    const todayStr = todayCI();
    const today = new Date(todayStr + 'T00:00:00Z');
    let cur = new Date(toDateStr(souscripteur.date_inscription) + 'T00:00:00Z');

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
      souscripteur: {
        id: souscripteur.id,
        nom: souscripteur.nom,
        telephone: souscripteur.telephone,
        montant_journalier: souscripteur.montant_journalier,
        date_inscription: souscripteur.date_inscription,
      },
      paiements,
      nombre_paiements: paiements.length,
      total_paye: totalPaye,
      jours_manques: joursManques.reverse(),
      nombre_jours_manques: joursManques.length,
      paye_aujourd_hui: datesPayees.has(todayStr),
    });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const FREQUENCES_VALIDES = ['journalier', 'hebdomadaire', 'mensuel', 'trimestriel', 'semestriel', 'annuel'];
  const { nom, telephone, montant_journalier, commercial_id, frequence_collecte } = req.body;
  const frequence = FREQUENCES_VALIDES.includes(frequence_collecte) ? frequence_collecte : 'journalier';
  try {
    const existe = await db('cotisants').where({ telephone }).first();
    if (existe) {
      return res.status(409).json({ message: `Le numéro ${telephone} est déjà enregistré.` });
    }
    const [souscripteur] = await db('cotisants')
      .insert({ nom, telephone, montant_journalier, commercial_id, frequence_collecte: frequence, date_inscription: new Date() })
      .returning('*');
    logger.info(`Souscripteur créé #${souscripteur.id} par admin #${req.user.id}`);
    logActivite({ utilisateur_id: req.user.id, action: 'SOUSCRIPTEUR_CREE', entite: 'souscripteur', entite_id: souscripteur.id, details: { nom, telephone } });
    res.status(201).json(souscripteur);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  const FREQUENCES_VALIDES = ['journalier', 'hebdomadaire', 'mensuel', 'trimestriel', 'semestriel', 'annuel'];
  try {
    const { nom, telephone, montant_journalier, commercial_id, frequence_collecte } = req.body;
    const updates = { nom, telephone, montant_journalier, commercial_id, updated_at: new Date() };
    if (frequence_collecte && FREQUENCES_VALIDES.includes(frequence_collecte)) {
      updates.frequence_collecte = frequence_collecte;
    }
    const [souscripteur] = await db('cotisants')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*');
    if (!souscripteur) return res.status(404).json({ message: 'Souscripteur introuvable.' });
    logActivite({ utilisateur_id: req.user.id, action: 'SOUSCRIPTEUR_MODIFIE', entite: 'souscripteur', entite_id: souscripteur.id, details: { nom } });
    res.json(souscripteur);
  } catch (err) { next(err); }
};

exports.desactiver = async (req, res, next) => {
  try {
    const [souscripteur] = await db('cotisants')
      .where({ id: req.params.id })
      .update({ actif: false, updated_at: new Date() })
      .returning('*');
    if (!souscripteur) return res.status(404).json({ message: 'Souscripteur introuvable.' });
    logger.info(`Souscripteur #${souscripteur.id} désactivé par admin #${req.user.id}`);
    logActivite({ utilisateur_id: req.user.id, action: 'SOUSCRIPTEUR_DESACTIVE', entite: 'souscripteur', entite_id: souscripteur.id });
    res.json({ message: 'Souscripteur désactivé.', souscripteur });
  } catch (err) { next(err); }
};

exports.activer = async (req, res, next) => {
  try {
    const [souscripteur] = await db('cotisants')
      .where({ id: req.params.id })
      .update({ actif: true, updated_at: new Date() })
      .returning('*');
    if (!souscripteur) return res.status(404).json({ message: 'Souscripteur introuvable.' });
    logger.info(`Souscripteur #${souscripteur.id} réactivé par admin #${req.user.id}`);
    logActivite({ utilisateur_id: req.user.id, action: 'SOUSCRIPTEUR_ACTIVE', entite: 'souscripteur', entite_id: souscripteur.id });
    res.json({ message: 'Souscripteur réactivé.', souscripteur });
  } catch (err) { next(err); }
};

exports.supprimer = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const souscripteur = await db('cotisants').where({ id }).first();
    if (!souscripteur) return res.status(404).json({ message: 'Souscripteur introuvable.' });

    const [{ n }] = await db('paiements').where({ cotisant_id: id }).count('id as n');
    const nbPaiements = Number(n);

    // Un souscripteur encore actif avec des paiements ne peut pas être supprimé :
    // il faut d'abord le désactiver. Une fois désactivé, la suppression définitive
    // (avec ses paiements) est autorisée.
    if (nbPaiements > 0 && souscripteur.actif) {
      return res.status(409).json({
        message: `Suppression impossible : ${nbPaiements} paiement(s) enregistré(s) pour ce souscripteur. Désactivez-le d'abord.`,
        code: 'A_DES_PAIEMENTS',
      });
    }

    await db.transaction(async (trx) => {
      if (nbPaiements > 0) {
        await trx('paiements').where({ cotisant_id: id }).del();
      }
      await trx('cotisants').where({ id }).del();
    });

    logger.info(`Souscripteur #${id} supprimé par admin #${req.user.id} (${nbPaiements} paiement(s) supprimé(s))`);
    logActivite({ utilisateur_id: req.user.id, action: 'SOUSCRIPTEUR_SUPPRIME', entite: 'souscripteur', entite_id: id, details: { nom: souscripteur.nom, paiements_supprimes: nbPaiements } });
    res.json({ message: 'Souscripteur supprimé.' });
  } catch (err) { next(err); }
};
