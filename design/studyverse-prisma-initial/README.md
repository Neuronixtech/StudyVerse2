# StudyVerse — Initial Prisma Models

This package contains the first Prisma ORM 7 data model baseline for StudyVerse.

## Files

- `prisma/schema.prisma` — initial models, enums, relations and indexes.
- `prisma7.config.ts` — Prisma 7 CLI configuration (Prisma 7.10+ recognizes `prisma7.config.ts`).
- `prisma/extra-constraints.sql` — PostgreSQL partial unique indexes and `CHECK` constraints that Prisma Schema Language does not express directly.
- `.env.example` — local PostgreSQL connection example.

## Version baseline

Use Prisma ORM **7.10.1**, not an unpinned `latest` tag. As of 20 November 2026, Prisma ORM 8 is still a release candidate, while Prisma ORM 7 remains the stable schema-first line. Lock `prisma` and `@prisma/client` to the same exact 7.x version until the project deliberately validates a major-version upgrade.

Prisma 7 requires a PostgreSQL driver adapter and ESM project setup.

Example dependencies for a backend package:

```json
{
  "type": "module",
  "dependencies": {
    "@prisma/adapter-pg": "7.10.1",
    "@prisma/client": "7.10.1",
    "dotenv": "^16.6.1",
    "pg": "^8.16.3"
  },
  "devDependencies": {
    "prisma": "7.10.1",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3"
  }
}
```

Use the exact adapter version matching the selected Prisma 7 release. Review current compatibility before upgrading any package.

## Initial setup

1. Copy `prisma/`, `prisma7.config.ts`, and `.env.example` into the backend repository root. The schema generator outputs Prisma Client to `apps/api/src/generated/prisma`; adjust the output path if your repo layout differs.
2. Create a local PostgreSQL 18 database and copy `.env.example` to `.env`.
3. Install the dependencies above.
4. Format and validate:

```bash
npx prisma@7.10.1 format
npx prisma@7.10.1 validate
```

5. Generate the first migration without applying it:

```bash
npx prisma@7.10.1 migrate dev --create-only --name init
```

6. Append the contents of `prisma/extra-constraints.sql` to the generated initial migration's `migration.sql`. Review the generated SQL and the appended constraints together. The extra SQL assumes the model/table/enum names in this package are unchanged.
7. Apply the migration locally:

```bash
npx prisma@7.10.1 migrate dev
npx prisma@7.10.1 generate
```

8. Commit the schema and migration to version control. Production deployment uses `prisma migrate deploy`, never `migrate dev` or `db push`.

Do not apply the initial migration to production before reviewing the SQL and testing it against a disposable database.

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
