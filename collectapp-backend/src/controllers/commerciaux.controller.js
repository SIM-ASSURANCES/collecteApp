const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const logger = require('../config/logger');

exports.list = async (req, res, next) => {
  try {
    const commerciaux = await db('utilisateurs')
      .where({ role: 'COMMERCIAL' })
      .select('id', 'nom', 'identifiant', 'actif', 'derniere_connexion');
    res.json(commerciaux);
  } catch (err) { next(err); }
};

const todayCI = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Abidjan' }).format(new Date());

exports.getOne = async (req, res, next) => {
  try {
    const commercial = await db('utilisateurs')
      .where({ id: req.params.id, role: 'COMMERCIAL' })
      .select('id', 'nom', 'identifiant', 'actif', 'derniere_connexion')
      .first();
    if (!commercial) return res.status(404).json({ message: 'Commercial introuvable.' });

    const cotisants = await db('cotisants')
      .where({ commercial_id: commercial.id, actif: true })
      .select('id', 'nom', 'telephone', 'montant_journalier')
      .orderBy('nom');

    // Paiements du jour de ce commercial
    const paiementsJour = await db('paiements')
      .where({ commercial_id: commercial.id, date: todayCI(), statut: 'paye' })
      .select('cotisant_id', 'montant', 'mode', 'horodatage');
    const payeMap = new Map(paiementsJour.map((p) => [p.cotisant_id, p]));

    // CA collecté aujourd'hui / CA non collecté (cotisants non payés)
    let ca_collecte = 0;
    let ca_non_collecte = 0;
    const cotisantsEnrichis = cotisants.map((c) => {
      const p = payeMap.get(c.id);
      if (p) ca_collecte += Number(p.montant);
      else ca_non_collecte += Number(c.montant_journalier);
      return {
        ...c,
        paye_aujourd_hui: !!p,
        mode_paiement: p ? p.mode : null,
        heure_paiement: p ? p.horodatage : null,
      };
    });

    // CA total collecté (toutes dates)
    const [{ total }] = await db('paiements')
      .where({ commercial_id: commercial.id, statut: 'paye' })
      .sum('montant as total');

    res.json({
      ...commercial,
      cotisants: cotisantsEnrichis,
      nombre_cotisants: cotisants.length,
      nombre_payes: paiementsJour.length,
      nombre_impayes: cotisants.length - paiementsJour.length,
      ca_collecte,
      ca_non_collecte,
      ca_total_collecte: Number(total) || 0,
    });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { nom, identifiant, mot_de_passe } = req.body;
  try {
    const existe = await db('utilisateurs').where({ identifiant }).first();
    if (existe) return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' });

    const hash = await bcrypt.hash(mot_de_passe, 10);
    const [commercial] = await db('utilisateurs')
      .insert({ nom, identifiant, mot_de_passe_hash: hash, role: 'COMMERCIAL' })
      .returning('id', 'nom', 'identifiant', 'role');

    logger.info(`Commercial créé #${commercial.id} par admin #${req.user.id}`);
    res.status(201).json(commercial);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { nom, identifiant, mot_de_passe } = req.body;
    const update = { nom, identifiant, updated_at: new Date() };
    if (mot_de_passe) update.mot_de_passe_hash = await bcrypt.hash(mot_de_passe, 10);

    const [commercial] = await db('utilisateurs')
      .where({ id: req.params.id })
      .update(update)
      .returning('id', 'nom', 'identifiant');
    if (!commercial) return res.status(404).json({ message: 'Commercial introuvable.' });
    res.json(commercial);
  } catch (err) { next(err); }
};

exports.reassignerCotisants = async (req, res, next) => {
  const { cotisant_ids, nouveau_commercial_id } = req.body;
  if (!Array.isArray(cotisant_ids) || !cotisant_ids.length) {
    return res.status(400).json({ message: 'Liste de cotisants requise.' });
  }
  try {
    await db('cotisants')
      .whereIn('id', cotisant_ids)
      .update({ commercial_id: nouveau_commercial_id, updated_at: new Date() });
    logger.info(`${cotisant_ids.length} cotisants réassignés au commercial #${nouveau_commercial_id}`);
    res.json({ message: `${cotisant_ids.length} cotisant(s) réassigné(s).` });
  } catch (err) { next(err); }
};

exports.desactiver = async (req, res, next) => {
  try {
    const [u] = await db('utilisateurs')
      .where({ id: req.params.id })
      .update({ actif: false })
      .returning('id', 'nom');
    if (!u) return res.status(404).json({ message: 'Commercial introuvable.' });
    res.json({ message: 'Commercial désactivé.', commercial: u });
  } catch (err) { next(err); }
};

exports.activer = async (req, res, next) => {
  try {
    const [u] = await db('utilisateurs')
      .where({ id: req.params.id, role: 'COMMERCIAL' })
      .update({ actif: true, updated_at: new Date() })
      .returning('id', 'nom');
    if (!u) return res.status(404).json({ message: 'Commercial introuvable.' });
    res.json({ message: 'Commercial réactivé.', commercial: u });
  } catch (err) { next(err); }
};

exports.supprimer = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const u = await db('utilisateurs').where({ id, role: 'COMMERCIAL' }).first();
    if (!u) return res.status(404).json({ message: 'Commercial introuvable.' });

    const [{ nc }] = await db('cotisants').where({ commercial_id: id }).count('id as nc');
    const [{ np }] = await db('paiements').where({ commercial_id: id }).count('id as np');
    const [{ nr }] = await db('reversements').where({ commercial_id: id }).count('id as nr');
    if (Number(nc) > 0 || Number(np) > 0 || Number(nr) > 0) {
      return res.status(409).json({
        message: `Suppression impossible : ${nc} cotisant(s), ${np} paiement(s) et ${nr} reversement(s) liés. `
          + 'Réassignez ses cotisants puis désactivez-le.',
        code: 'A_DES_LIENS',
      });
    }
    await db('utilisateurs').where({ id }).del();
    logger.info(`Commercial #${id} supprimé par admin #${req.user.id}`);
    res.json({ message: 'Commercial supprimé.' });
  } catch (err) { next(err); }
};
