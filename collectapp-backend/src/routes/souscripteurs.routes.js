const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/souscripteurs.controller');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth);

// Lecture accessible admin + superviseur + collecteur (le collecteur voit seulement ses souscripteurs)
router.get('/', authorize('ADMIN', 'SUPERVISEUR', 'COLLECTEUR'), ctrl.list);
router.get('/search', authorize('ADMIN', 'SUPERVISEUR', 'COLLECTEUR'), ctrl.search);
router.get('/:id', authorize('ADMIN', 'SUPERVISEUR', 'COLLECTEUR'), param('id').isInt(), ctrl.getOne);
router.get('/:id/historique', authorize('ADMIN', 'SUPERVISEUR', 'COLLECTEUR'), param('id').isInt(), ctrl.historique);

// Écriture réservée aux ADMIN / SUPERVISEUR
router.post(
  '/',
  authorize('ADMIN', 'SUPERVISEUR'),
  [
    body('nom').notEmpty().withMessage('Le nom est requis.'),
    body('telephone').notEmpty().withMessage('Le téléphone est requis.'),
    body('montant_journalier').isFloat({ gt: 0 }).withMessage('Le montant doit être positif.'),
    body('commercial_id').isInt().withMessage('Le collecteur est requis.'),
    body('frequence_collecte').optional().isIn(['journalier', 'hebdomadaire', 'mensuel', 'trimestriel', 'semestriel', 'annuel']).withMessage('Fréquence invalide.'),
  ],
  ctrl.create
);

router.put('/:id', authorize('ADMIN', 'SUPERVISEUR'), [param('id').isInt()], ctrl.update);
router.patch('/:id/desactiver', authorize('ADMIN', 'SUPERVISEUR'), param('id').isInt(), ctrl.desactiver);
router.patch('/:id/activer', authorize('ADMIN', 'SUPERVISEUR'), param('id').isInt(), ctrl.activer);
router.delete('/:id', authorize('ADMIN'), param('id').isInt(), ctrl.supprimer);

module.exports = router;
