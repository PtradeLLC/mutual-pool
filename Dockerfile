# Single long-running instance: state is held in memory and persisted to
# Postgres (src/server/persistence.ts). Deploy with exactly one instance and a
# stop-then-start deploy strategy: see fly.toml and DEPLOY.md.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite inlines VITE_* variables at build time.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_PROD_URL
ARG VITE_TREASURY_ENABLED=false
ARG VITE_SUPPORT_EMAIL
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# The weekly deposit (Thursday 12:00 AM) and payout (Friday 12:00 AM) sweeps run
# on server-local time; without this the container runs on UTC. Override with
# --set-env-vars=TZ=... if members are promised a different time zone.
ENV TZ=America/New_York
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/server.cjs"]
