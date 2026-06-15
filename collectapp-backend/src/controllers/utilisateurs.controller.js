const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const logger = require('../config/logger');
const logActivite = require('../utils/logActivite');

const PERMISSIONS_VALIDES = [
  'dashboard', 'cotisants', 'collecteurs', 'reversements',
  'statistiques', 'relances', 'utilisateurs',
];

// Les collecteurs sont gérés via /api/collecteurs (page dédiée)
const ROLES_VALIDES = ['ADMIN', 'SUPERVISEUR'];

const champsPublics = [
  'id', 'nom', 'identifiant', 'role', 'permissions', 'actif', 'derniere_connexion', 'created_at',
];

function nettoyerPermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.filter((p) => PERMISSIONS_VALIDES.includes(p)))];
}

// Garde-fou : toujours conserver au moins un ADMIN actif
async function estDernierAdminActif(id) {
  const cible = await db('utilisateurs').where({ id }).first();
  if (!cible || cible.role !== 'ADMIN' || !cible.actif) return false;
  const [{ n }] = await db('utilisateurs')
    .where({ role: 'ADMIN', actif: true })
    .whereNot({ id })
    .count('id as n');
  return Number(n) === 0;
}

exports.list = async (req, res, next) => {
  try {
    const utilisateurs = await db('utilisateurs')
      .whereIn('role', ROLES_VALIDES)
      .select(champsPublics)
      .orderBy('created_at', 'desc');
    res.json(utilisateurs);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { nom, identifiant, mot_de_passe, role, permissions } = req.body;
  if (!ROLES_VALIDES.includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide.' });
  }
  try {
    const existe = await db('utilisateurs').where({ identifiant }).first();
    if (existe) return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' });

    const hash = await bcrypt.hash(mot_de_passe, 10);
    const [utilisateur] = await db('utilisateurs')
      .insert({
        nom,
        identifiant,
        mot_de_passe_hash: hash,
        role,
        // ADMIN et COLLECTEUR : permissions implicites au rôle
        permissions: JSON.stringify(role === 'SUPERVISEUR' ? nettoyerPermissions(permissions) : []),
      })
      .returning(champsPublics);

    logger.info(`Utilisateur #${utilisateur.id} créé (${role}) par admin #${req.user.id}`);
    logActivite({ utilisateur_id: req.user.id, action: 'UTILISATEUR_CREE', entite: 'utilisateur', entite_id: utilisateur.id, details: { nom, role } });
    res.status(201).json(utilisateur);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  const { nom, identifiant, mot_de_passe, role, permissions, actif } = req.body;
  const id = Number(req.params.id);
  try {
    const cible = await db('utilisateurs').where({ id }).first();
    if (!cible) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    // Garde-fous sur le dernier admin actif
    const retrograde = role && role !== 'ADMIN' && cible.role === 'ADMIN';
    const desactive  = actif === false && cible.actif;
    if ((retrograde || desactive) && (await estDernierAdminActif(id))) {
      return res.status(400).json({ message: 'Impossible : c\'est le dernier administrateur actif.' });
    }
    if (id === req.user.id && actif === false) {
      return res.status(400).json({ message: 'Vous ne pouvez pas désactiver votre propre compte.' });
    }

    const update = { updated_at: new Date() };
    if (nom !== undefined)         update.nom = nom;
    if (identifiant !== undefined) update.identifiant = identifiant;
    if (actif !== undefined)       update.actif = actif;
    if (role !== undefined) {
      if (!ROLES_VALIDES.includes(role)) return res.status(400).json({ message: 'Rôle invalide.' });
      update.role = role;
    }
    if (permissions !== undefined || role !== undefined) {
      const roleFinal = role || cible.role;
      const permsFinales = roleFinal === 'SUPERVISEUR'
        ? nettoyerPermissions(permissions !== undefined ? permissions : cible.permissions)
        : [];
      update.permissions = JSON.stringify(permsFinales);
    }
    if (mot_de_passe) update.mot_de_passe_hash = await bcrypt.hash(mot_de_passe, 10);

    const [utilisateur] = await db('utilisateurs')
      .where({ id })
      .update(update)
      .returning(champsPublics);

    logger.info(`Utilisateur #${id} modifié par admin #${req.user.id}`);
    logActivite({ utilisateur_id: req.user.id, action: 'UTILISATEUR_MODIFIE', entite: 'utilisateur', entite_id: id });
    res.json(utilisateur);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' });
    }
    next(err);
  }
};
