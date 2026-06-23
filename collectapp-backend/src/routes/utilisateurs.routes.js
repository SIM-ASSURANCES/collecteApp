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
    body('nom').trim().notEmpty().withMessage('Le nom est requis.'),
    body('identifiant').trim().isLength({ min: 3 }).withMessage("L'identifiant doit comporter au moins 3 caractères."),
    body('mot_de_passe').isLength({ min: 6 }).withMessage('Le mot de passe doit comporter au moins 6 caractères.'),
    body('role').isIn(['ADMIN', 'SUPERVISEUR']).withMessage('Rôle invalide.'),
  ],
  ctrl.create
);

router.put('/:id', ctrl.update);

module.exports = router;
