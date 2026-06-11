const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl = require('../controllers/cotisants.controller');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth);

// Lecture accessible admin + commercial (le commercial voit seulement ses cotisants)
router.get('/', authorize('ADMIN', 'COMMERCIAL'), ctrl.list);
router.get('/search', authorize('ADMIN', 'COMMERCIAL'), ctrl.search);
router.get('/:id', authorize('ADMIN', 'COMMERCIAL'), param('id').isInt(), ctrl.getOne);

router.post(
  '/',
  [
    body('nom').notEmpty().withMessage('Le nom est requis.'),
    body('telephone').notEmpty().withMessage('Le téléphone est requis.'),
    body('montant_journalier').isFloat({ gt: 0 }).withMessage('Le montant doit être positif.'),
    body('commercial_id').isInt().withMessage('Le commercial est requis.'),
  ],
  ctrl.create
);

router.put(
  '/:id',
  [param('id').isInt()],
  ctrl.update
);

router.patch('/:id/desactiver', param('id').isInt(), ctrl.desactiver);

module.exports = router;
