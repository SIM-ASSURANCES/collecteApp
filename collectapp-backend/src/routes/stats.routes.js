const router = require('express').Router();
const ctrl = require('../controllers/stats.controller');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth, authorize('ADMIN'));

router.get('/dashboard',    ctrl.dashboard);    // Compteurs du jour
router.get('/taux-collecte', ctrl.tauxCollecte); // Taux journalier/hebdo/mensuel
router.get('/commerciaux',  ctrl.classementCommerciaux);
router.get('/retardataires', ctrl.retardataires); // Cotisants avec N jours impayés
router.get('/export',       ctrl.export);        // CSV ou PDF

// SSE — flux temps réel tableau de bord
router.get('/events', ctrl.sseEvents);

module.exports = router;
