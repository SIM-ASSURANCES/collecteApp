require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'collectapp_db',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
    },
    migrations: { directory: './db/migrations' },
    seeds:      { directory: './db/seeds' },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host:     process.env.DB_HOST     || 'postgres',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'collectapp_db',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
    },
    migrations: { directory: './db/migrations' },
    seeds:      { directory: './db/seeds' },
    pool: { min: 2, max: 10 },
  },
};
