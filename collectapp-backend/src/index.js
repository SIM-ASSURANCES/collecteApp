require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const errorHandler = require('./middlewares/errorHandler');

// ── Garde-fous de configuration : refus de démarrer sans secret ──
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL : JWT_SECRET manquant ou trop court (min 32 caractères).');
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';
const app = express();

// Derrière le reverse-proxy (Traefik/Nginx) — nécessaire pour le rate-limit par IP
app.set('trust proxy', 1);

// Sécurité & parsing (limite de taille + capture du corps brut pour la signature webhook)
app.use(helmet());
app.use(cors({
  origin: isProd ? (process.env.CORS_ORIGIN || false) : '*',
}));
app.use(express.json({
  limit: '100kb',
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(morgan('dev'));

// Rate-limiting global
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, réessayez dans un instant.' },
}));

// Rate-limiting renforcé sur l'authentification (anti brute-force)
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de connexion. Réessayez plus tard.' },
}));

// Documentation API — désactivée en production (évite la divulgation d'informations)
if (!isProd) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Routes
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/cotisants',    require('./routes/cotisants.routes'));
app.use('/api/commerciaux',  require('./routes/commerciaux.routes'));
app.use('/api/paiements',    require('./routes/paiements.routes'));
app.use('/api/reversements', require('./routes/reversements.routes'));
app.use('/api/stats',        require('./routes/stats.routes'));
app.use('/api/utilisateurs', require('./routes/utilisateurs.routes'));

// Santé
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Gestion des erreurs
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));

module.exports = app;
