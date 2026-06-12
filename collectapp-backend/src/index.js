require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const swaggerUi   = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Sécurité & parsing
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Documentation API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
