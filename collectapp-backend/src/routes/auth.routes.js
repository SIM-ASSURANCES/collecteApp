const router = require('express').Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const auth = require('../middlewares/auth');

router.post(
  '/login',
  [
    body('identifiant').notEmpty().withMessage("L'identifiant est requis."),
    body('mot_de_passe').notEmpty().withMessage('Le mot de passe est requis.'),
  ],
  authController.login
);

router.post('/logout', auth, authController.logout);

module.exports = router;
