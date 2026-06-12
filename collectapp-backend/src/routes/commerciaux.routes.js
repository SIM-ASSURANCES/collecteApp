const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl = require('../controllers/commerciaux.controller');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth, authorize('ADMIN', 'SUPERVISEUR'));

router.get('/', ctrl.list);
router.get('/:id', param('id').isInt(), ctrl.getOne);

router.post(
  '/',
  [
    body('nom').notEmpty(),
    body('identifiant').notEmpty(),
    body('mot_de_passe').isLength({ min: 6 }).withMessage('Minimum 6 caractÃ¨res.'),
  ],
  ctrl.create
);

router.put('/:id', param('id').isInt(), ctrl.update);
router.patch('/:id/reassigner', param('id').isInt(), ctrl.reassignerCotisants);
router.patch('/:id/desactiver', param('id').isInt(), ctrl.desactiver);

module.exports = router;
