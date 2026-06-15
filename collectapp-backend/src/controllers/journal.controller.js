const db = require('../config/db');

const ACTION_LABELS = {
  LOGIN: 'Connexion',
  SOUSCRIPTEUR_CREE: 'Souscripteur créé',
  SOUSCRIPTEUR_MODIFIE: 'Souscripteur modifié',
  SOUSCRIPTEUR_SUPPRIME: 'Souscripteur supprimé',
  SOUSCRIPTEUR_ACTIVE: 'Souscripteur activé',
  SOUSCRIPTEUR_DESACTIVE: 'Souscripteur désactivé',
  COLLECTEUR_CREE: 'Collecteur créé',
  COLLECTEUR_MODIFIE: 'Collecteur modifié',
  COLLECTEUR_SUPPRIME: 'Collecteur supprimé',
  REVERSEMENT_VALIDE: 'Reversement validé',
  REVERSEMENT_REJETE: 'Reversement rejeté',
  REVERSEMENT_SUPPRIME: 'Reversement supprimé',
  UTILISATEUR_CREE: 'Utilisateur créé',
  UTILISATEUR_MODIFIE: 'Utilisateur modifié',
};

exports.list = async (req, res, next) => {
  try {
    const { limit = 200, offset = 0, action, entite } = req.query;
    let query = db('journal_activites')
      .leftJoin('utilisateurs', 'journal_activites.utilisateur_id', 'utilisateurs.id')
      .select(
        'journal_activites.*',
        'utilisateurs.nom as utilisateur_nom',
        'utilisateurs.role as utilisateur_role',
      )
      .orderBy('journal_activites.created_at', 'desc')
      .limit(Math.min(Number(limit), 500))
      .offset(Number(offset));

    if (action) query = query.where('journal_activites.action', action);
    if (entite) query = query.where('journal_activites.entite', entite);

    const journal = await query;
    res.json(journal.map(row => ({ ...row, action_label: ACTION_LABELS[row.action] ?? row.action })));
  } catch (err) { next(err); }
};

exports.actionsList = async (req, res, next) => {
  try {
    const rows = await db('journal_activites').distinct('action').orderBy('action');
    res.json(rows.map(r => ({ action: r.action, label: ACTION_LABELS[r.action] ?? r.action })));
  } catch (err) { next(err); }
};
