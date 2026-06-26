const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const logger = require('../config/logger');
const logActivite = require('../utils/logActivite');

exports.list = async (req, res, next) => {
  try {
    const collecteurs = await db('utilisateurs')
      .where({ role: 'COLLECTEUR' })
      .select('id', 'nom', 'identifiant', 'actif', 'derniere_connexion');
    res.json(collecteurs);
  } catch (err) { next(err); }
};

const todayCI = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Abidjan' }).format(new Date());

exports.getOne = async (req, res, next) => {
  try {
    const collecteur = await db('utilisateurs')
      .where({ id: req.params.id, role: 'COLLECTEUR' })
      .select('id', 'nom', 'identifiant', 'actif', 'derniere_connexion')
      .first();
    if (!collecteur) return res.status(404).json({ message: 'Collecteur introuvable.' });

    const cotisants = await db('cotisants')
      .where({ commercial_id: collecteur.id, actif: true })
      .select('id', 'nom', 'telephone', 'montant_journalier')
      .orderBy('nom');

    const paiementsJour = await db('paiements')
      .where({ commercial_id: collecteur.id, date: todayCI(), statut: 'paye' })
      .select('cotisant_id', 'montant', 'mode', 'horodatage');
    const payeMap = new Map(paiementsJour.map((p) => [p.cotisant_id, p]));

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

    const [{ total }] = await db('paiements')
      .where({ commercial_id: collecteur.id, statut: 'paye' })
      .sum('montant as total');

    res.json({
      ...collecteur,
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
    const [collecteur] = await db('utilisateurs')
      .insert({ nom, identifiant, mot_de_passe_hash: hash, role: 'COLLECTEUR' })
      .returning('id', 'nom', 'identifiant', 'role');

    logger.info(`Collecteur créé #${collecteur.id} par admin #${req.user.id}`);
    logActivite({ utilisateur_id: req.user.id, action: 'COLLECTEUR_CREE', entite: 'collecteur', entite_id: collecteur.id, details: { nom } });
    res.status(201).json(collecteur);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    // Garantir que la cible est bien un COLLECTEUR (empêche l'élévation de privilèges vers ADMIN)
    const cible = await db('utilisateurs').where({ id: req.params.id }).first();
    if (!cible || cible.role !== 'COLLECTEUR') {
      return res.status(403).json({ message: 'Action réservée aux comptes collecteur.' });
    }

    const { nom, identifiant, mot_de_passe } = req.body;
    const update = { nom, identifiant, updated_at: new Date() };
    if (mot_de_passe) update.mot_de_passe_hash = await bcrypt.hash(mot_de_passe, 10);

    const [collecteur] = await db('utilisateurs')
      .where({ id: req.params.id, role: 'COLLECTEUR' })
      .update(update)
      .returning('id', 'nom', 'identifiant');
    if (!collecteur) return res.status(404).json({ message: 'Collecteur introuvable.' });
    res.json(collecteur);
  } catch (err) { next(err); }
};

exports.reassignerCotisants = async (req, res, next) => {
  const { cotisant_ids, nouveau_commercial_id } = req.body;
  if (!Array.isArray(cotisant_ids) || !cotisant_ids.length) {
    return res.status(400).json({ message: 'Liste de cotisants requise.' });
  }
  if (!nouveau_commercial_id) {
    return res.status(400).json({ message: 'nouveau_commercial_id est requis.' });
  }
  try {
    // Valider que le collecteur de destination existe et est actif
    const destination = await db('utilisateurs')
      .where({ id: nouveau_commercial_id, role: 'COLLECTEUR', actif: true })
      .first();
    if (!destination) {
      return res.status(404).json({ message: 'Collecteur de destination introuvable ou inactif.' });
    }

    // Filtrer strictement : on ne réassigne que les cotisants appartenant au collecteur source
    const sourceId = parseInt(req.params.id, 10);
    const updated = await db('cotisants')
      .whereIn('id', cotisant_ids)
      .where({ commercial_id: sourceId })
      .update({ commercial_id: nouveau_commercial_id, updated_at: new Date() });

    logger.info(`${updated} souscripteurs réassignés de #${sourceId} vers #${nouveau_commercial_id}`);
    res.json({ message: `${updated} cotisant(s) réassigné(s).` });
  } catch (err) { next(err); }
};

exports.desactiver = async (req, res, next) => {
  try {
    const [u] = await db('utilisateurs')
      .where({ id: req.params.id })
      .update({ actif: false })
      .returning('id', 'nom');
    if (!u) return res.status(404).json({ message: 'Collecteur introuvable.' });
    res.json({ message: 'Collecteur désactivé.', collecteur: u });
  } catch (err) { next(err); }
};

exports.activer = async (req, res, next) => {
  try {
    const [u] = await db('utilisateurs')
      .where({ id: req.params.id, role: 'COLLECTEUR' })
      .update({ actif: true, updated_at: new Date() })
      .returning('id', 'nom');
    if (!u) return res.status(404).json({ message: 'Collecteur introuvable.' });
    res.json({ message: 'Collecteur réactivé.', collecteur: u });
  } catch (err) { next(err); }
};

exports.supprimer = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const u = await db('utilisateurs').where({ id, role: 'COLLECTEUR' }).first();
    if (!u) return res.status(404).json({ message: 'Collecteur introuvable.' });

    const [{ nc }] = await db('cotisants').where({ commercial_id: id }).count('id as nc');
    const [{ np }] = await db('paiements').where({ commercial_id: id }).count('id as np');
    const [{ nr }] = await db('reversements').where({ commercial_id: id }).count('id as nr');
    if (Number(nc) > 0 || Number(np) > 0 || Number(nr) > 0) {
      return res.status(409).json({
        message: `Suppression impossible : ${nc} souscripteur(s), ${np} paiement(s) et ${nr} reversement(s) liés. `
          + 'Réassignez ses souscripteurs puis désactivez-le.',
        code: 'A_DES_LIENS',
      });
    }
    await db('utilisateurs').where({ id }).del();
    logger.info(`Collecteur #${id} supprimé par admin #${req.user.id}`);
    logActivite({ utilisateur_id: req.user.id, action: 'COLLECTEUR_SUPPRIME', entite: 'collecteur', entite_id: id, details: { nom: u.nom } });
    res.json({ message: 'Collecteur supprimé.' });
  } catch (err) { next(err); }
};
