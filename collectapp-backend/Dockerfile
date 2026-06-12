FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5000
CMD ["sh", "-c", "node db/bootstrap.js && node src/index.js"]
