const router = require('express').Router();
const ctrl = require('../controllers/journal.controller');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

router.use(auth);
router.get('/', authorize('ADMIN'), ctrl.list);
router.get('/actions', authorize('ADMIN'), ctrl.actionsList);

module.exports = router;
