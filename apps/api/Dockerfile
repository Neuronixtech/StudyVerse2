# syntax=docker/dockerfile:1
#
# StudyVerse API image. Build from the repository root: the API compiles the Prisma
# schema in ../../prisma.
#
#   docker build -f apps/api/Dockerfile --target runtime  -t studyverse-api .
#   docker build -f apps/api/Dockerfile --target migrator -t studyverse-api-migrator .
#
# runtime   the API: production dependencies only, non-root, read-only code.
# migrator  runs `prisma migrate deploy` once per deployment (Backend_architecture.md §12.2).
#
# No secrets are baked in. DATABASE_URL and every other setting come from environment
# variables at run time; .env files are excluded from the build context.

# Must match apps/api/.nvmrc (checked by src/runtime-versions.spec.ts).
ARG NODE_VERSION=22.23.5

FROM node:${NODE_VERSION}-trixie-slim AS build
WORKDIR /repo/apps/api
# Dependencies first, for layer caching. postinstall runs `prisma generate`, which needs
# the schema and the CLI config.
COPY apps/api/package.json apps/api/package-lock.json apps/api/prisma.config.ts ./
COPY prisma /repo/prisma
RUN npm ci --no-audit --no-fund
COPY apps/api/ ./
RUN npm run build

# One-off migration job: the build stage still has the Prisma CLI and the migrations.
FROM build AS migrator
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# Production dependencies only, installed fresh from the lockfile. --omit=optional also
# drops packages the lockfile marks devOptional: dev tools that are optional peers of
# runtime packages (the Prisma CLI and Studio, TypeScript), which `npm prune --omit=dev`
# keeps (433 MB vs 159 MB). --ignore-scripts skips postinstall: the generated Prisma
# client is already compiled into dist.
FROM node:${NODE_VERSION}-trixie-slim AS runtime-deps
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund

FROM node:${NODE_VERSION}-trixie-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
WORKDIR /app
# Owned by root and only readable by the app user, so the process can't modify its code.
COPY --from=runtime-deps /app/package.json ./package.json
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 3001
# Liveness only; readiness (/api/v1/health/ready) is for orchestrators that route traffic.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/v1/health/live').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--enable-source-maps", "dist/main.js"]
