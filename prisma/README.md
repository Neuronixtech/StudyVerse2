# StudyVerse — Prisma Data Model

The Prisma ORM 7 data model for StudyVerse. It started as the reviewed starter baseline and is shared by the API (`apps/api`) and, later, the background worker.

## Files

| Path | Purpose |
|---|---|
| `prisma/schema.prisma` | Models, enums, relations and indexes |
| `prisma/extra-constraints.sql` | Partial unique indexes and `CHECK` constraints that Prisma Schema Language can't express. Appended to the initial migration |
| `prisma/migrations/` | Versioned migrations, committed to Git (created once the initial schema is approved) |
| `apps/api/prisma.config.ts` | Prisma CLI configuration: schema and migration paths, database URLs |
| `apps/api/.env.example` | Template for the git-ignored `apps/api/.env` |

The generator writes Prisma Client to `apps/api/src/generated/prisma` (git-ignored; run `npm run prisma:generate`).

## Version baseline

Prisma ORM **7.10.1**, pinned exactly in `apps/api/package.json` for `prisma`, `@prisma/client` and `@prisma/adapter-pg`. Prisma 7 requires a PostgreSQL driver adapter and an ESM project.

Never run an unpinned `npx prisma`: npm's `latest` tag for `prisma` is an 8.0 release candidate, while `@prisma/client`'s is 7.10.1. Use the npm scripts, which run the pinned CLI. Upgrade all three packages together, deliberately.

## Database roles and URLs

The API connects as `studyverse_app`, which can read and write rows but can't change the schema. Migrations run as `studyverse_migrator`, which owns the databases (Backend_architecture.md §13.1).

| Variable | Used by |
|---|---|
| `DATABASE_URL` | The running API (app role) |
| `DATABASE_MIGRATION_URL` | Prisma CLI: migrations (owner role) |
| `DATABASE_SHADOW_URL` | Local `migrate dev` only: scratch database |
| `TEST_DATABASE_URL`, `TEST_DATABASE_MIGRATION_URL` | Integration tests; database name must end in `_test` |

`prisma.config.ts` loads `apps/api/.env` with Node's built-in loader. Real environment variables take precedence, and `generate`/`validate` work without any database URL.

## Commands

Run from `apps/api`:

```bash
npm ci
npm run db:validate          # prisma validate + format --check
npm run db:format            # prisma format
npm run prisma:generate      # regenerate the client after schema changes
npm run db:migrate:status
npm run db:migrate:deploy    # apply committed migrations (CI, containers, deployments)
npm run db:migrate:dev       # local development databases only
```

## Migration policy

- The initial migration is generated with `migrate dev --create-only --name init`. `extra-constraints.sql` is appended to its `migration.sql`, and the combined SQL is reviewed before it is applied anywhere.
- Once merged, a migration is never edited. Changes are new migrations.
- `migrate dev` only against local databases; `migrate deploy` everywhere else; never `db push`; never a destructive reset outside local and test databases.
- Review generated SQL for locks, backfills, large indexes and destructive statements before merging.

## Important design notes

### This is an initial model baseline, not the complete final schema

The models cover identity, RBAC, course catalog, subscriptions, progress, assessments, video processing, bookstore operations, notifications, outbox events and audit logs. They do not replace the separate product, bookstore, video-pipeline, or backend architecture documents.

### Invariants enforced in application services

Some rules span multiple rows/tables and need transactional service validation in addition to database constraints:

- `Course.previewLessonId` must reference a lesson whose module belongs to that same course.
- `Lesson.activeVideoAssetId` must reference a ready video asset belonging to that lesson.
- `Test.activeVersionId` must reference a published version belonging to that test.
- `TestVersionQuestion.sectionId` must reference a section in the same test version.
- Subscription approval must create/extend a period atomically and only after an admin verifies actual payment.
- Stock reservation, order placement and inventory balance changes must occur in one transaction with concurrency-safe updates.
- A video asset becomes ready only after HLS verification and source-archive checksum verification.
- A replacement video must never replace the old active asset before the new asset is ready and explicitly activated.

Do not assume a Prisma relation alone proves that two linked rows belong to the same parent aggregate. Validate these relationships in the owning service; add raw SQL composite constraints/triggers if later required.

### Additional database constraints

`extra-constraints.sql` adds:
- At most one pending subscription request per user.
- At most one designated free demo test.
- At most one primary photo per product.
- At most one pending admin invitation per normalized email.
- At most one default address per learner.
- At most one active cart per user or guest token.
- Exactly one identity for a cart and an exam attempt (learner or guest).
- Positive durations, sizes, and quantities; valid time ranges; nonnegative money and inventory; and order total arithmetic.

The SQL uses PostgreSQL partial unique indexes and `CHECK` constraints. Prisma schema cannot represent every such constraint, so keep the companion SQL in the versioned migration history.

### Session storage

`UserSession` is the application's session-inventory/audit model. The `connect-pg-simple` adapter owns its separate standard `session` table (`sid`, `sess`, `expire`) and should create/manage it as configured by the adapter. Do not create a conflicting Prisma-managed table with that same name. The application must keep session IDs out of logs and use a secure, HttpOnly, SameSite cookie. A production review should confirm how session revocation updates both the adapter's session row and `user_sessions` record.

### Money and BigInt

Amounts are stored as integer paise in `BigInt` fields. Convert/serialize BigInt deliberately in JSON API responses (for example, as decimal strings); JavaScript `JSON.stringify` does not serialize BigInt by default.

### Historical data

Published test versions and submitted exam attempts are immutable historical records. Orders preserve product/price/address snapshots. Products and courses with user history should be archived rather than deleted.

### Queue ownership

`VideoProcessingJob` and `OutboxEvent` are StudyVerse domain records. pg-boss has its own internal schema/tables and should manage those itself; do not model pg-boss internal tables in Prisma.

### Intentionally deferred

- Complete notification/email delivery attempt history.
- MFA factors/recovery codes and WebAuthn credentials.
- Fine-grained tax/invoice accounting for the bookstore.
- Detailed analytics/event warehouse.
- Optional scheduled exam windows and advanced anti-cheat telemetry.
- Multi-tenant tenancy model; initial product is one StudyVerse platform.

These can be added when their workflows are agreed, rather than bloating the first migration.

## Before production

- Run Prisma format and validate using the pinned CLI.
- Apply the initial migration to a disposable PostgreSQL 18 database.
- Inspect migration SQL for destructive or unexpected statements.
- Add and test default Owner/Staff/Learner roles and permissions through a seed script.
- Test all check constraints and partial indexes.
- Test concurrent inventory reservations and attempt submissions.
- Configure database backups and prove a restore before taking real learner data.
