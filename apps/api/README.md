# StudyVerse API

The NestJS backend for StudyVerse: a modular monolith on PostgreSQL 18 with Prisma 7, as described in [`design/docs/Backend_architecture.md`](../../design/docs/Backend_architecture.md). The data model and migration policy are in [`prisma/README.md`](../../prisma/README.md).

Status: Milestone 1 (backend foundation). The API boots, validates its configuration, logs, handles errors and reports health. Business modules and the initial database migration come next; the migration waits for schema approval.

## Requirements

- Node.js **22.23.5**, pinned in [`.nvmrc`](.nvmrc) (`nvm use` in `apps/api`). Any 22.x from 22.22.3 works (`engines`; `@nestjs/schematics` needs 22.22.3). CI (`setup-node` reads `.nvmrc`) and the container image (`ARG NODE_VERSION` in the Dockerfile) use the same version; `src/runtime-versions.spec.ts` fails if they drift apart
- PostgreSQL 18: the Docker Compose service in [`infra/`](../../infra/compose.yaml), or any PostgreSQL 18 with the same roles

## Local setup

```bash
# 1. PostgreSQL 18.7 on 127.0.0.1:5432, with the studyverse roles and databases
cp infra/.env.example infra/.env          # set the three passwords
docker compose -f infra/compose.yaml up -d

# 2. The API
cd apps/api
cp .env.example .env                       # use the role passwords from infra/.env
npm ci                                     # also generates the Prisma client
npm run start:dev                          # http://127.0.0.1:3001/api/v1/health/ready
```

`.env` is git-ignored. Real environment variables override it. Deployments set variables directly and have no `.env` file.

## Container

[`Dockerfile`](Dockerfile) builds from the repository root, because it needs `prisma/`:

| Target     | Contents                                                                                                                           | Runs                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `runtime`  | `dist/` and production dependencies only (no Prisma CLI, TypeScript or test tools), code owned by root, process as the `node` user | `node dist/main.js`; `HEALTHCHECK` probes `/api/v1/health/live` |
| `migrator` | The build stage, with the Prisma CLI and the migrations                                                                            | `prisma migrate deploy` once, then exits                        |

No secrets or `.env` files are in the image (`Dockerfile.dockerignore`): configuration comes from environment variables at run time. `SIGTERM` (for example `docker stop`) closes the HTTP server and the database pool and exits 0 (`src/shutdown.ts`).

`docker compose -f infra/compose.yaml --profile app up -d` runs PostgreSQL, the `migrate` job, then the API on `127.0.0.1:3001`. The API container is `read_only`, drops every Linux capability and sets `no-new-privileges`. The profile applies migrations to the local `studyverse` database. CI's `container` job runs the same stack and checks health, the user, the absence of env files and the shutdown exit code.

## Scripts

| Command                           | What it does                                          |
| --------------------------------- | ----------------------------------------------------- |
| `npm run start:dev`               | Build and run with file watching                      |
| `npm run build` / `npm start`     | Compile to `dist/` / run the compiled app             |
| `npm run lint`                    | oxlint with type-aware rules                          |
| `npm run format` / `format:check` | Prettier                                              |
| `npm run typecheck`               | `tsc --noEmit` over `src/` and `test/`                |
| `npm test`                        | Unit and HTTP tests; no database or network needed    |
| `npm run test:integration`        | Integration tests against a PostgreSQL test database  |
| `npm run openapi:update`          | Rewrite `openapi.v1.json` after a reviewed API change |
| `npm run prisma:generate`         | Regenerate the Prisma client                          |
| `npm run db:validate`             | `prisma validate` and `prisma format --check`         |
| `npm run db:migrate:*`            | Prisma Migrate; see the policy in `prisma/README.md`  |

## Configuration

All settings come from environment variables, documented in [`.env.example`](.env.example). They are validated at startup. An invalid or missing variable stops the process with a list of every problem; the list names the variables and never prints their values.

| Variable                                           | Default                           | Notes                                                        |
| -------------------------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| `NODE_ENV`                                         | required                          | `development`, `test` or `production`                        |
| `HOST`, `PORT`                                     | `127.0.0.1`, `3001`               | Use `0.0.0.0` only inside a container                        |
| `LOG_LEVEL`                                        | `info`                            | `fatal` to `trace`, or `silent`                              |
| `DATABASE_URL`                                     | required                          | The least-privilege `studyverse_app` role                    |
| `DATABASE_POOL_MAX`, `DATABASE_CONNECT_TIMEOUT_MS` | `10`, `5000`                      | Connection pool bounds                                       |
| `HEALTH_DB_TIMEOUT_MS`                             | `2000`                            | Readiness check timeout                                      |
| `SWAGGER_ENABLED`                                  | `true`, but `false` in production | OpenAPI docs at `/api/docs`                                  |
| `CORS_ORIGINS`                                     | empty                             | Exact origins, comma-separated; empty means same-origin only |
| `TRUST_PROXY`                                      | `false`                           | `1` behind Caddy                                             |

The Prisma CLI also reads `DATABASE_MIGRATION_URL` (owner role) and `DATABASE_SHADOW_URL`. The integration tests read `TEST_DATABASE_URL` and `TEST_DATABASE_MIGRATION_URL`.

## HTTP conventions

- **Versioned routes** under `/api/v1` (§9.1).
- **Errors** are RFC 9457 Problem Details, `application/problem+json` (§9.4):

  ```json
  {
    "type": "about:blank",
    "title": "Bad Request",
    "status": 400,
    "detail": "The request is invalid.",
    "instance": "/api/v1/...",
    "code": "validation_failed",
    "requestId": "3f1c2a9e-...",
    "errors": [{ "field": "address.postalCode", "messages": ["postalCode must be a string"] }]
  }
  ```

  Client errors keep their message. Server errors always say "An unexpected error occurred." and are logged with the request ID. Responses never include stack traces, SQL, hosts or query strings. Codes so far: `validation_failed`, `malformed_json`, `payload_too_large`, `malformed_url`, `unsupported_encoding`, `unsupported_charset`, `request_aborted`.

- **Validation**: DTOs are validated, unknown fields are rejected, and values are transformed to their declared types (§9.3).
- **Request IDs**: every response has `X-Request-Id`. A caller's value is reused if it is a short, safe token; otherwise one is generated.
- **Security**: helmet headers; JSON bodies only, up to 100 kB; CORS off unless configured (§9.7).

## Endpoints

| Method and path            | Response                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/health/live`  | `200 {"status":"ok",...}`. The process is serving. Never touches the database                                                                      |
| `GET /api/v1/health/ready` | `200` when the database answers `SELECT 1` within `HEALTH_DB_TIMEOUT_MS`, otherwise `503` with `error.database.status = "down"`. No driver details |

Health responses aren't cacheable and aren't written to the request log.

## API contract

The OpenAPI 3 document is generated from the code and served at `/api/docs` (JSON at `/api/docs/openapi.json`) when `SWAGGER_ENABLED` is on. [`openapi.v1.json`](openapi.v1.json) is the committed contract. `npm test` fails when the code and the contract differ, so contract changes show up in review. After reviewing a change, run `npm run openapi:update` and commit the file.

## Logging

One JSON line per request on stdout: `time`, `level`, `service`, `env`, the request ID, method, path, status and duration. Bodies, headers, cookies and query strings are never logged, and sensitive fields are redacted as a second layer. Health probes are not logged.

## Tests

- **Unit and HTTP** (`src/**/*.spec.ts`, `npm test`): configuration, request IDs, logging, error format, security headers, CORS, proxy trust, health with an unreachable database, and the OpenAPI contract. Tests build the app with `createTestApp`, which uses the same setup as `main.ts`.
- **Integration** (`test/**/*.int-spec.ts`, `npm run test:integration`) against a real PostgreSQL 18 test database. The global setup refuses to run unless both test URLs point at a database whose name ends in `_test`, empties it, and applies the committed migrations with `prisma migrate deploy`. Suites:
  - `health`, `database-roles`: readiness and role privileges.
  - `schema/migration`: one migration applied completely, a second deploy is a no-op, no drift, every custom index, CHECK, trigger and function present, the app role has exactly row access to every table.
  - `schema/test-versions`, `schema/attempts`: published-version immutability (including TRUNCATE and cascades), sections and section timers, guest retakes, one in-progress attempt, guest-attempt claims.
  - `schema/decisions`: write-once payment and subscription decisions, resubmission history, the corrections the model supports.
  - `schema/carts`, `schema/stock`: one active cart per guest, idempotent and concurrent-safe guest cart merge, no overselling under concurrent reservations.
  - `schema/deactivation`, `schema/constraints`: deactivation keeps history, RESTRICT blocks hard deletes, and the remaining CHECKs and unique indexes.

  Rules are exercised as the app role (`studyverse_app`), mostly inside rolled-back transactions.

- **CI**: [`.github/workflows/backend-tests.yml`](../../.github/workflows/backend-tests.yml) runs everything on each pull request, against a `postgres:18.7` service with the same roles.

## Layout

```text
apps/api/
├── src/
│   ├── main.ts                  # load config, create the app, listen
│   ├── app.module.ts            # root module, built from a validated config
│   ├── app.setup.ts             # HTTP conventions shared by main.ts and tests
│   ├── config/                  # environment validation, APP_CONFIG token
│   ├── common/errors/           # Problem Details filter, validation pipe
│   ├── common/logging/          # pino logging, request IDs
│   ├── database/                # PrismaService
│   ├── health/                  # live and ready endpoints
│   ├── openapi/                 # contract generation and docs
│   ├── testing/                 # createTestApp, testConfig
│   └── generated/prisma/        # Prisma client (generated, git-ignored)
├── test/                        # integration tests
├── openapi.v1.json              # committed API contract
└── prisma.config.ts             # Prisma CLI configuration (schema in ../../prisma)
```
