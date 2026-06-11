const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const logger = require('../config/logger');

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MIN = 15;

exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { identifiant, mot_de_passe } = req.body;
  try {
    const user = await db('utilisateurs').where({ identifiant }).first();

    if (!user || !user.actif) {
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
    }

    // Vérification verrouillage
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(401).json({
        message: `Compte verrouillé. Réessayez après ${LOCK_DURATION_MIN} minutes.`,
      });
    }

    const valid = await bcrypt.compare(mot_de_passe, user.mot_de_passe_hash);
    if (!valid) {
      const attempts = (user.tentatives_connexion || 0) + 1;
      const update = { tentatives_connexion: attempts };
      if (attempts >= MAX_ATTEMPTS) {
        update.locked_until = new Date(Date.now() + LOCK_DURATION_MIN * 60 * 1000);
        update.tentatives_connexion = 0;
      }
      await db('utilisateurs').where({ id: user.id }).update(update);
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
    }

    // Réinitialiser les tentatives
    await db('utilisateurs').where({ id: user.id }).update({
      tentatives_connexion: 0,
      locked_until: null,
      derniere_connexion: new Date(),
    });

    const token = jwt.sign(
      { id: user.id, role: user.role, nom: user.nom },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    logger.info(`Connexion réussie — utilisateur #${user.id} (${user.role})`);
    res.json({ token, user: { id: user.id, nom: user.nom, role: user.role } });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  logger.info(`Déconnexion — utilisateur #${req.user.id}`);
  res.json({ message: 'Déconnexion réussie.' });
};
