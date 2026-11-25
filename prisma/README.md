# StudyVerse — Prisma Data Model

The Prisma ORM 7 data model for StudyVerse. It started as the reviewed starter baseline and is shared by the API (`apps/api`) and, later, the background worker.

## Files

| Path | Purpose |
|---|---|
| `prisma/schema.prisma` | Models, enums, relations and indexes |
| `prisma/extra-constraints.sql` | Partial unique indexes and `CHECK` constraints that Prisma Schema Language can't express. Appended to the initial migration |
| `prisma/migrations/` | Versioned migrations, committed to Git. `20261125070533_init` is the initial migration (generated and tested; awaiting approval before it is applied anywhere persistent) |
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

- The initial migration was generated with `migrate dev --create-only --name init` (identical to `migrate diff --from-empty --to-schema`, apart from that command's `CREATE SCHEMA IF NOT EXISTS "public"` preamble). `extra-constraints.sql` is appended verbatim; `apps/api/src/database/migrations.spec.ts` checks the two copies stay identical.
- **Every migration is wrapped in `BEGIN;` … `COMMIT;`.** Prisma doesn't make migrations transactional on PostgreSQL (tested on 18.7: a failing statement left the earlier ones applied). Wrapped, a failure leaves nothing behind; recover with `prisma migrate resolve --rolled-back <name>` and deploy the fixed migration. Statements that can't run in a transaction (for example `CREATE INDEX CONCURRENTLY`) go in a migration of their own, without the wrapper.
- Once applied anywhere shared, a migration is never edited. Changes are new migrations. Hand-written rules (constraints, triggers) go into the new migration's SQL; `extra-constraints.sql` stays as the record of the initial migration's rules.
- The app role's table access comes from the default privileges set by `infra/postgres/init/01-roles-and-databases.sh` in each database. A database created any other way must get the same `GRANT`/`ALTER DEFAULT PRIVILEGES` statements before the first deploy, or the API can't read its tables.
- Every integration-test run empties the `_test` database and applies the committed migrations with `prisma migrate deploy` (`apps/api/test/setup/global-setup.ts`), then checks a second deploy is a no-op and the live schema has no drift.
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
- `AttemptQuestionState` and `AttemptSectionState` rows must reference a question or section of the attempt's own test version. (A question's section, by contrast, is enforced in the database by a composite foreign key.)
- A section-timed version (`timingMode = SECTION`) needs a `durationSeconds` on every section.
- Associating a guest demo attempt with a learner on sign-in sets `userId`, clears `guestTokenHash` and renumbers the attempt after the learner's existing attempts, in one transaction.
- Merging a guest cart at sign-in follows "Guest cart merge" below: one transaction, idempotent, quantities by the prototype's rule.
- Subscription approval must create/extend a period atomically and only after an admin verifies actual payment.
- Stock reservation, order placement and inventory balance changes must occur in one transaction with concurrency-safe updates.
- A video asset becomes ready only after HLS verification and source-archive checksum verification.
- A replacement video must never replace the old active asset before the new asset is ready and explicitly activated.

Do not assume a Prisma relation alone proves that two linked rows belong to the same parent aggregate. Validate these relationships in the owning service; add raw SQL composite constraints/triggers if later required.

### Additional database constraints

`extra-constraints.sql` adds partial unique indexes:
- At most one pending subscription request per user.
- At most one designated free demo test.
- At most one primary photo per product.
- At most one pending admin invitation per normalized email.
- At most one default address per learner.
- At most one active cart per learner and per guest token; older carts are kept.
- At most one in-progress attempt per learner or guest per test.
- At most one active section per attempt.

`CHECK` constraints:
- Exactly one identity for a cart and for an exam attempt (learner or guest).
- A `MERGED` cart names the cart it was merged into, and only merged carts do.
- A decided subscription request or payment names the reviewer and time; a rejection names a reason.
- A `DEACTIVATED` account has `deactivatedAt`.
- Section timer state: non-negative time used; a locked section is never active.
- Failed sign-ins carry a reason code. Request events change status, and rejections carry a reason. Completed idempotency records store a response status between 100 and 599.
- Positive durations, sizes and quantities; valid time ranges; non-negative money and inventory; order total arithmetic.

And triggers:
- **Published test versions are immutable.** Once a version is `PUBLISHED` or `SUPERSEDED`, only the move to `SUPERSEDED`, `answerReviewReleaseAt` and `updatedAt` may change, and the version can't be deleted. Its sections and questions can't be added, changed or removed.
- **Decisions are final.** A decided payment submission or subscription request is write-once, and neither can be deleted.
- **No TRUNCATE** on `test_versions`, `test_version_sections`, `test_version_questions`, `payment_submissions` or `subscription_requests`. Row-level triggers don't fire on TRUNCATE, so these statement-level guards close that bypass for the owner role as well. The API's role has no TRUNCATE right at all.

Prisma Schema Language can't express any of these. Prisma also leaves them alone: diffing a database that has them against the schema reports no difference (verified on PostgreSQL 18.7). Keep the SQL in the versioned migration history. The trigger error code is `integrity_constraint_violation` (SQLSTATE 23000).

### Session storage (Milestone 2)

`UserSession` is the application's session inventory and audit record. Sign-in sessions for `express-session` live in the store table that `connect-pg-simple` uses (`sid`, `sess`, `expire`). That table is created by a Prisma migration in Milestone 2, not by the store:

- A `Session` model (`@@map("session")`, `sid` VARCHAR primary key, `sess` JSON, `expire` TIMESTAMPTZ(6), index `IDX_session_expire`) is added with the authentication milestone, together with its migration.
- The store runs with `createTableIfMissing: false`. The API's `studyverse_app` role has no CREATE right on the schema, so the store couldn't create an unmanaged table anyway.

Why: on PostgreSQL 18.7, a `session` table created by the store's own `table.sql` makes Prisma report `DROP TABLE "session"` when diffing the database against the schema. `migrate dev` would treat that as drift. With the model and migration in place, the diff is empty. `connect-pg-simple` 10.0.0 ran set, get, touch, prune and destroy against the migration-owned table (`expire` as `timestamptz`; the store's queries use `to_timestamp()`) as a role with row access only. Session IDs stay out of logs; revocation deletes the store row and sets `user_sessions.revokedAt` in one transaction.

### Account deletion and foreign keys

Accounts are deactivated (`status = DEACTIVATED`, `deactivatedAt`), never hard-deleted by the application. Attempts, subscriptions, orders and audit history stay. Anonymizing personal fields waits for the account-deletion retention policy. Foreign keys to `users` follow that policy:

| Behaviour | Used for |
|---|---|
| CASCADE | Data owned only by the account: credentials, OAuth links, auth tokens, user sessions, role and permission assignments, addresses, carts, notifications, lesson progress |
| RESTRICT | History and proof of who acted: orders, subscription requests and periods, test attempts, decision reviewers, refunds, stock movements, order/request/release events, audit logs, role and permission grantors, invitation senders |
| SET NULL | Incidental metadata: course and video authorship, invitation acceptor, last settings editor, playback grants, the learner on auth events |

An accidental hard delete of a user with history therefore fails instead of erasing or orphaning it.

**Deactivation is not deletion.** A `DEACTIVATED` account keeps its personal data (name, email, phone, addresses) and all historical records under the current model. A deliberate personal-data retention and deletion policy (what is erased or anonymized, when, and what must be kept for payments, subscriptions and exam records) is still required before production (architecture §14.3, PLAN.md open questions). Nothing in the schema or application deletes or anonymizes data automatically.

**What the database guarantees today:** deactivation changes only the user row. Attempts, payments, subscription requests and periods, orders, audit logs, sessions and tokens all remain. Hard deletion is refused wherever the `RESTRICT` policy applies (verified in `apps/api/test/schema/deactivation.int-spec.ts`).

**Deferred to Milestone 2 (authentication), required there:**
- Sign-in (password and Google) succeeds only for `ACTIVE` users. `SUSPENDED`, `PENDING_DELETION` and `DEACTIVATED` are refused with the same generic response as wrong credentials (architecture §8.2).
- Deactivating or suspending an account runs in one transaction that sets `user_sessions.revokedAt` for every open session, deletes the matching rows from the session-store table, and marks every unconsumed `auth_tokens` row consumed. Each session-authenticated request rechecks that the user is `ACTIVE`, so a session that escaped revocation still fails.
- Redeeming an email-verification or password-reset token checks the user's status as well as expiry and `consumedAt`.
- An `auth_events` row (`ACCOUNT_SUSPENDED`, `ALL_SESSIONS_REVOKED`) and an `audit_logs` row record who deactivated the account.
- Integration tests in that milestone cover each item above.

### Guest cart merge

At sign-in the guest cart is merged into the learner's cart. The rule for a book that is in both carts comes from the prototype (`mergeGuestCart` in `src/lib/store.ts`): the learner's cart keeps the **larger** of the two quantities, not their sum. Taking the maximum is idempotent: merging the same carts twice gives the same result. Quantities above available stock stay in the cart, and checkout is blocked until the customer adjusts them (BOOKSTORE_SPEC §5.1); the merge never trims or drops items.

The bookstore service runs the merge in one transaction:

1. `SELECT ... FOR UPDATE` the guest cart. If it is no longer `ACTIVE`, stop: it was already merged, so a retried login or a concurrent second request does nothing.
2. Find the learner's `ACTIVE` cart, or create it (the partial unique index allows only one).
3. Copy the guest items: `INSERT ... ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = GREATEST(cart_items.quantity, EXCLUDED.quantity)`.
4. Mark the guest cart `MERGED` with `mergedIntoCartId`. Its items stay as the historical record.

The guest cart is never re-owned or deleted. A browser keeping its guest token can start a new `ACTIVE` cart afterwards. Verified on PostgreSQL 18.7, including a retried merge and two concurrent merges (`apps/api/test/schema/carts.int-spec.ts`).

### Correcting payment and subscription decisions

Decisions are write-once (trigger), so a mistake is corrected by a new, attributable record, never by editing the original. What the approved product defines, and the model supports today:

| Mistake | Correction | Recorded as |
|---|---|---|
| Payment wrongly rejected | Customer resubmits against the same order (BOOKSTORE_SPEC §6.3) | New `payment_submissions` row; the rejected row is unchanged |
| Subscription request wrongly rejected | Learner submits a new request, or an admin activates manually (prototype `activateManually`) | New `subscription_requests` row, or a `subscription_periods` row with `activatedById` (RESTRICT), plus an `audit_logs` entry |

**Gap, not yet decided:** the product doesn't define how to correct a wrong *approval*. Today a subscription period can be set to `REVOKED` with `revokedAt` and `revocationReason`, but there is no column for who revoked it. A wrongly approved bookstore payment has no correction record at all, only order status changes, `order_events` and `audit_logs`. `audit_logs` rows can still be updated or deleted by the API's role. Proposed smallest change, awaiting a product decision before implementation:
1. `subscription_periods.revokedById` (FK to users, RESTRICT) and a CHECK that a `REVOKED` period has `revokedAt`, `revokedById` and `revocationReason`.
2. An append-only `decision_corrections` table: the corrected `payment_submission_id` or `subscription_request_id` (exactly one), `correctedById` (RESTRICT), a required reason and a timestamp, with no UPDATE or DELETE (trigger). The original decision row is never touched; the effective outcome is "original decision, unless corrected". The follow-up (revoking the period, cancelling the order or recording a refund through the existing tables) happens in the same transaction.
3. `audit_logs` made append-only (no UPDATE, DELETE or TRUNCATE).

### Differences from Backend_architecture.md

Table inventory in architecture §7.3 compared with this schema, as reviewed and approved in November 2026.

**Consolidated tables.** Each keeps the architecture's functionality:

| Architecture | Here | How the functionality is kept |
|---|---|---|
| `email_verification_tokens`, `password_reset_tokens` | `auth_tokens` with `purpose` | Hashed (`tokenHash` unique), single-use (`consumedAt`), expiring (`expiresAt`) per purpose |
| `sessions` | `user_sessions` (+ the store's `session` table, Milestone 2) | Inventory and revocation in `user_sessions`; session data in the store table |
| `attempt_answers` | `attempt_question_states.answer` | One row per (attempt, question), unique, so duplicate answer writes are impossible (§7.4) |
| `payment_decisions` | decision columns on `payment_submissions` | One row per submission, so resubmissions keep earlier decisions. Decision is write-once (trigger), reviewer and time required (CHECK), reviewer `RESTRICT`, rows never deleted. The order timeline (`order_events`) and `audit_logs` record the action too |
| `question_options` | `question_bank_options` | Same content (options with correct flags and order), named after the question bank |
| `test_sections` (editable) | sections of a `DRAFT` test version | A draft version is the editable test; publishing freezes it (trigger). Editing a published test creates a new draft version, and attempts keep their version (§10.3) |

**Additional tables and relationships** (not in the architecture inventory):

| Table / relationship | Purpose |
|---|---|
| `user_permissions` (`ALLOW`/`DENY`) | Per-user overrides of role permissions for Staff (§8.6: "granular and configurable" permissions). Grantor recorded; changes audited in `audit_logs` |
| `test_exam_categories`, `test_subjects`, `test_courses` | Many-to-many links from tests to exam categories, subjects and courses (§2.3: tests can be associated with categories, subjects and courses) |
| `stock_reservations` | Per-order, per-product reserved quantities with expiry and payment-submitted time; drives reservation expiry (§10.4) alongside `inventory_balances.reservedQuantity` |
| `attempt_section_states` | Server-side section timers and locks per attempt (PLAN.md §6.3, §10.3) |
| `test_version_sections.subjectId` | A section's subject (prototype sections are per subject) |
| `test_versions.resultReleaseMode` | `IMMEDIATE` or `MANUAL` answer-review release (PLAN.md §6.5) |
| `carts.mergedIntoCartId` + `MERGED` | Guest cart merged into a learner's cart at sign-in (BOOKSTORE_SPEC §3.2) |
| `users.deactivatedAt` + `DEACTIVATED` | Soft-deleted accounts |
| `tests.kind` (`TestKind`) | Catalog classification: full, sectional, chapter or practice test (prototype). Metadata only; sections and timing stay on versions |

**Deferred** (not in the initial migration): `email_delivery_attempts` (with notifications), `media_assets` (the architecture says "if useful"), MFA factors (deferred decision 2), the session store table (Milestone 2).

### Money and BigInt

Amounts are stored as integer paise in `BigInt` fields. Convert/serialize BigInt deliberately in JSON API responses (for example, as decimal strings); JavaScript `JSON.stringify` does not serialize BigInt by default.

### Historical data

Published test versions and submitted exam attempts are immutable historical records. Orders preserve product/price/address snapshots. Products and courses with user history should be archived rather than deleted.

### Queue ownership

`VideoProcessingJob` and `OutboxEvent` are StudyVerse domain records. pg-boss has its own internal schema/tables and should manage those itself; do not model pg-boss internal tables in Prisma.

### Intentionally deferred

- Complete notification/email delivery attempt history (`email_delivery_attempts`).
- MFA factors/recovery codes and WebAuthn credentials.
- The `express-session` store table (Milestone 2, see above).
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
