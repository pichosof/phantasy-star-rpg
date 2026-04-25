FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY drizzle.config.ts tsconfig.json ./
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src ./src

RUN npm run build \
  && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3010 \
    DATABASE_URL=/app/data/app.db \
    UPLOADS_LOCAL_DIR=/app/data/uploads

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data/uploads /app/data/tmp

EXPOSE 3010

CMD ["node", "dist/app.js"]
