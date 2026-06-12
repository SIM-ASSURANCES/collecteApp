const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/utilisateurs.controller');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

// Gestion des utilisateurs — réservée aux administrateurs
router.use(auth, authorize('ADMIN'));

router.get('/', ctrl.list);

router.post(
  '/',
  [
    body('nom').trim().notEmpty(),
    body('identifiant').trim().isLength({ min: 3 }),
    body('mot_de_passe').isLength({ min: 6 }),
    body('role').isIn(['ADMIN', 'SUPERVISEUR', 'COMMERCIAL']),
  ],
  ctrl.create
);

router.put('/:id', ctrl.update);

module.exports = router;
