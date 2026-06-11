FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000
CMD ["sh", "-c", "node -e \"const knex=require('knex')(require('./knexfile')[process.env.NODE_ENV||'production']); knex.migrate.latest().then(()=>{console.log('Migrations OK'); process.exit(0)}).catch(e=>{console.error(e); process.exit(1)})\" && node src/index.js"]
