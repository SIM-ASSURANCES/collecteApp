const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/reversements.controller');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth);

// Commercial dÃ©clare son reversement
router.post(
  '/',
  authorize('COLLECTEUR'),
  [body('montant_declare').isFloat({ gt: 0 })],
  ctrl.declarer
);

// Commercial vÃ©rifie si un reversement a dÃ©jÃ  Ã©tÃ© soumis aujourd'hui
router.get('/today', authorize('COLLECTEUR'), ctrl.todayReversement);

// Historique des reversements du commercial connecte
router.get('/mes', authorize('COLLECTEUR'), ctrl.mesReversements);

// Session Wave pour regler un reversement
router.post('/wave-session', authorize('COLLECTEUR'),
  [body('montant').isFloat({ gt: 0 })], ctrl.creerSessionWaveReversement);

// Rafraichir le statut de paiement Wave d'un reversement
router.get('/:id/statut-wave', authorize('COLLECTEUR', 'ADMIN', 'SUPERVISEUR'),
  param('id').isInt(), ctrl.statutWave);

// Admin consulte tous les reversements
router.get('/', authorize('ADMIN', 'SUPERVISEUR'), ctrl.list);

// Admin valide ou rejette
router.patch(
  '/:id/valider',
  authorize('ADMIN', 'SUPERVISEUR'),
  param('id').isInt(),
  ctrl.valider
);

router.patch(
  '/:id/rejeter',
  authorize('ADMIN', 'SUPERVISEUR'),
  [param('id').isInt(), body('motif').notEmpty()],
  ctrl.rejeter
);

// Admin supprime un reversement
router.delete('/:id', authorize('ADMIN'), param('id').isInt(), ctrl.supprimer);

module.exports = router;
