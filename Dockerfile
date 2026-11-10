# Builds the whole app (website + API) into ONE image, for hosting such as Railway.
# Build context is the repository root (the folder that contains both project folders).
#
#   1. build the website (React + Vite)
#   2. build the API (NestJS), copy the website next to it, and start both from one address
#
# The database and photos live on a persistent volume, which is only attached when the container STARTS,
# so migrations and seeding run in railway-start.sh, not here.

# ---- 1. The website ----
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY College-Business-Corner-Frontend/package.json College-Business-Corner-Frontend/package-lock.json ./
RUN npm ci
COPY College-Business-Corner-Frontend/ ./
# No VITE_API_URL: a production build then talks to the address it is served from.
RUN npm run build

# ---- 2. The API, serving the website ----
# The full (non-slim) image includes the compilers better-sqlite3 needs if no ready-made binary exists.
FROM node:22-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# The schema and Prisma config must be here before `npm ci`, because the Prisma client is generated from them.
COPY College-Business-Corner-Backend/package.json College-Business-Corner-Backend/package-lock.json ./
COPY College-Business-Corner-Backend/prisma ./prisma
COPY College-Business-Corner-Backend/prisma7.config.ts ./
RUN npm ci
# Prisma 7 does not generate the client on install. Without this, src/generated/prisma does not exist
# (it is gitignored) and `nest build` fails with "Property 'user' does not exist on type 'PrismaService'".
RUN npx prisma generate

COPY College-Business-Corner-Backend/ ./
RUN npm run build
COPY --from=web /web/dist ./public

ENV NODE_ENV=production
CMD ["sh", "/app/railway-start.sh"]
