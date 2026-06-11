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
      .where('nom', 'ilike', `%${q}%`)
      .orWhere('telephone', 'ilike', `%${q}%`)
      .where({ actif: true })
      .select('id', 'nom', 'telephone', 'montant_journalier', 'commercial_id');
    res.json(results);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const cotisant = await db('cotisants').where({ id: req.params.id }).first();
    if (!cotisant) return res.status(404).json({ message: 'Cotisant introuvable.' });
    res.json(cotisant);
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
