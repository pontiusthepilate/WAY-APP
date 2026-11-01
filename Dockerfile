# Builds the Expo web export and the Fastify backend separately, then
# combines them into one slim runtime image that serves both the API and
# the web app from a single Fastify server (see backend/src/index.ts).

FROM node:20-slim AS web-build
WORKDIR /web
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci
COPY mobile/ ./
# Same-origin: the web build and the API it talks to are served by the same
# Fastify instance, so a relative/empty base just works regardless of which
# hostname (fly.dev or the custom domain) it's reached through.
ENV EXPO_PUBLIC_API_URL=""
RUN npx expo export -p web --output-dir dist

FROM node:20-slim AS backend-build
# Prisma's query/schema engine binaries are compiled against libssl and
# silently fail (or pick the wrong engine) without it — node:20-slim has
# neither, so prisma generate must see it before it decides which engine
# to download, and the runtime stage below needs it again at run time.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-build /app/package.json /app/package-lock.json ./
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/prisma ./prisma
COPY --from=web-build /web/dist ./web
RUN mkdir -p uploads
EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
