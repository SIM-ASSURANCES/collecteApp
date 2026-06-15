const router = require('express').Router();
const ctrl = require('../controllers/stats.controller');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth, authorize('ADMIN', 'SUPERVISEUR'));

router.get('/dashboard',    ctrl.dashboard);    // Compteurs du jour
router.get('/taux-collecte', ctrl.tauxCollecte); // Taux journalier/hebdo/mensuel
router.get('/collecteurs',  ctrl.classementCollecteurs);
router.get('/retardataires', ctrl.retardataires); // Cotisants avec N jours impayÃ©s
router.get('/export',       ctrl.export);        // CSV ou PDF

// SSE â€” flux temps rÃ©el tableau de bord
router.get('/events', ctrl.sseEvents);

module.exports = router;
