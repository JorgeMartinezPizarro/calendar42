# syntax=docker/dockerfile:1

# ---- 1. Build del frontend ---------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 2. Imagen final: la API sirve también el frontend compilado -------------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist

# Las sesiones (tokens de la intra) van a un volumen, fuera del código.
RUN mkdir -p /data && chown node:node /data
USER node
ENV PORT=3000 \
    SESSIONS_FILE=/data/sessions.json \
    TZ=Europe/Madrid

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/api/health > /dev/null || exit 1

# Node ejecuta el TypeScript del servidor directamente (sin compilar).
CMD ["node", "server/index.ts"]
