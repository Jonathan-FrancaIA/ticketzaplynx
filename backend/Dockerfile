# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

# Apenas build, removido generate:i18nkeys
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./

# Instalar dependências de produção
RUN npm prune --production

# Instalar dockerize
RUN apk add --no-cache openssl
ENV DOCKERIZE_VERSION=v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-alpine-linux-amd64-$DOCKERIZE_VERSION.tar.gz

EXPOSE 8080

ENV NODE_ENV=production

CMD ["sh", "-c", "dockerize -wait tcp://$DB_HOST:$DB_PORT -timeout 60s && npx sequelize db:migrate --config dist/config/database.js --migrations-path dist/database/migrations && npx sequelize db:seed:all --config dist/config/database.js --seeders-path dist/database/seeds && node dist/server.js"]

