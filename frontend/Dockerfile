# Stage 1: Build the frontend
FROM node:17-alpine AS builder
WORKDIR /usr/src/app

# Adicione um argumento para a URL do backend
ARG REACT_APP_BACKEND_URL
# Defina a variável de ambiente para o processo de build
ENV REACT_APP_BACKEND_URL=https://api.zaplynx.com.br

COPY package*.json ./
RUN npm install --force

COPY . .
# O comando de build agora usará a variável de ambiente
RUN npm run build:linux

# Stage 2: Serve the static files
FROM node:17-alpine
WORKDIR /usr/src/app

# Copiar APENAS os arquivos buildados
COPY --from=builder /usr/src/app/build ./build

# Install 'serve' to serve the static files
RUN npm install -g serve

EXPOSE 8081

# Servir apenas a pasta build
CMD ["serve", "-s", "build", "-l", "8081"]