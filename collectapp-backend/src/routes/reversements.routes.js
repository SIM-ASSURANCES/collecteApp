const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/reversements.controller');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth);

// Commercial déclare son reversement
router.post(
  '/',
  authorize('COMMERCIAL'),
  [body('montant_declare').isFloat({ gt: 0 })],
  ctrl.declarer
);

// Commercial vérifie si un reversement a déjà été soumis aujourd'hui
router.get('/today', authorize('COMMERCIAL'), ctrl.todayReversement);

// Admin consulte tous les reversements
router.get('/', authorize('ADMIN'), ctrl.list);

// Admin valide ou rejette
router.patch(
  '/:id/valider',
  authorize('ADMIN'),
  param('id').isInt(),
  ctrl.valider
);

router.patch(
  '/:id/rejeter',
  authorize('ADMIN'),
  [param('id').isInt(), body('motif').notEmpty()],
  ctrl.rejeter
);

module.exports = router;
