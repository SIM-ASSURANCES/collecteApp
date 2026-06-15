const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/paiements.controller');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

// Webhook Wave — pas de auth JWT (signé par Wave)
router.post('/webhook/wave', ctrl.webhookWave);

// Routes protégées
router.use(auth);

// Session Wave Checkout (QR réel) — création + vérification de statut
router.post(
  '/wave/session',
  authorize('COLLECTEUR', 'ADMIN'),
  [
    body('cotisant_id').isInt(),
    body('nbjours').optional().isInt({ min: 1, max: 180 }),
  ],
  ctrl.creerSessionWave
);
router.get('/wave/session/:id', authorize('COLLECTEUR', 'ADMIN'), ctrl.statutSessionWave);

// Enregistrement paiement (Wave ou Manuel) depuis espace commercial — route générique
router.post(
  '/',
  authorize('COLLECTEUR', 'ADMIN'),
  [
    body('cotisant_id').isInt(),
    body('montant').isFloat({ gt: 0 }),
    body('mode').isIn(['wave', 'especes', 'cheque', 'autre']),
  ],
  ctrl.enregistrer
);

// Enregistrement paiement manuel historique (route conservée pour compatibilité)
router.post(
  '/manuel',
  authorize('COLLECTEUR', 'ADMIN'),
  [
    body('cotisant_id').isInt(),
    body('montant').isFloat({ gt: 0 }),
    body('mode').isIn(['especes', 'cheque', 'autre']),
  ],
  ctrl.enregistrerManuel
);

// Sommaire paiements du jour (montant total + nombre) pour reversement
router.get('/today/sommaire', ctrl.todaySommaire);

// Liste des paiements du jour (commercial : les siens ; admin : tous)
router.get('/today', ctrl.today);

// Historique paiements d'un cotisant
router.get('/cotisant/:id', auth, authorize('ADMIN'), param('id').isInt(), ctrl.historiqueCotisant);

// Synchronisation offline (commercial)
router.post('/sync', authorize('COLLECTEUR'), ctrl.syncOffline);

module.exports = router;
