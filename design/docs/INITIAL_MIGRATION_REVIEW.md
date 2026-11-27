# StudyVerse — Initial Migration Review

**Migration:** `prisma/migrations/20261125070533_init/migration.sql`
**Status:** generated and tested on PostgreSQL 18.7, in the official container. **Not applied** to staging, production or any persistent database. Awaiting approval.
**Branch:** `feature/backend-foundation`
**Prepared:** 25 November 2026. **Updated:** 26 November 2026 (append-only audit logs, decision corrections, published subject labels, `_prisma_migrations` privileges, container verification, rollback verification)

This document supports the approval of the initial database migration. It covers:

- the hand-written database rules and who can bypass them;
- the deletion policy;
- how the migration was tested, including on real containers;
- what is still unverified.

The inventory of database objects at the end is generated from PostgreSQL's catalog, not written by hand.

## 1. Files

| File | What it is |
|---|---|
| `prisma/migrations/20261125070533_init/migration.sql` | The complete migration (2,530 lines), wrapped in `BEGIN;` … `COMMIT;`. Part 1 is Prisma's generated DDL. Part 2 is `extra-constraints.sql`, verbatim |
| `prisma/migrations/migration_lock.toml` | Prisma's provider lock (`postgresql`) |
| `prisma/extra-constraints.sql` | The hand-written rules, the source of Part 2 |
| `prisma/schema.prisma` | The Prisma schema that Part 1 is generated from |
| `apps/api/scripts/initial-migration.mjs` | Builds the migration from the two files above (`npm run db:initial-migration`). With `-- --check` it fails if the committed migration differs |

**How it is produced:** `npm run db:initial-migration`, with Prisma 7.10.1 under Node 22.23.5, in four steps:

1. Run `prisma migrate diff --from-empty --to-schema ../../prisma/schema.prisma --script`. This needs no database.
2. Drop that command's `CREATE SCHEMA IF NOT EXISTS "public"` preamble.
3. Append `extra-constraints.sql` verbatim.
4. Wrap the result in a transaction.

The first version came from `prisma migrate dev --create-only --name init`, whose output is byte-identical to the diff without that preamble. Two checks keep the migration and its sources in sync: `npm run db:initial-migration -- --check`, and a unit test (`src/database/migrations.spec.ts`) that compares Part 2 with `extra-constraints.sql`. The script exists only until this migration is applied; after that, the migration is frozen.

**Why `BEGIN`/`COMMIT`:** Prisma 7.10.1 doesn't guarantee that a migration runs in one transaction. On PostgreSQL 18.7:

- a script without dollar-quoted bodies was sent one statement at a time, each committed on its own, so a failure left the earlier statements applied;
- a script with dollar-quoted bodies, like this one, went as a single message, which PostgreSQL runs as one implicit transaction.

The explicit transaction makes a failure roll back every statement in both cases. When a wrapped migration fails, Prisma reports `current transaction is aborted` instead of the cause, which is in the PostgreSQL log. It also records the attempt as failed. To recover, run `prisma migrate resolve --rolled-back 20261125070533_init`, then deploy the fixed migration. All of this was verified in a disposable container (section 5, "Rollback verification").

## 2. Hand-written rules (Part 2)

### Triggers (9 functions, 19 triggers)

| Function | Triggers | Rule |
|---|---|---|
| `guard_published_test_version()` | `test_versions_immutable_after_publish` (BEFORE UPDATE OR DELETE, per row) | Once a version is `PUBLISHED` or `SUPERSEDED`, only three things may change: the move `PUBLISHED → SUPERSEDED`, `answer_review_release_at` (release or withhold solutions) and `updated_at`. The version can't be deleted. Any other column change is refused, including moving it to another test or back to `DRAFT` |
| `guard_published_test_version_content()` | `test_version_sections_frozen_after_publish`, `test_version_questions_frozen_after_publish` (BEFORE INSERT OR UPDATE OR DELETE, per row) | Sections and questions can only be added, changed or removed while their version is a `DRAFT`. This covers section order, subject, subject-name snapshot, title, instructions and timers, and question assignment, order, prompts, answer keys and marking. A change whose parent row is already gone is a cascade from deleting a draft version, which is allowed |
| `snapshot_section_subjects_on_publish()` | `test_versions_snapshot_subjects_on_publish` (BEFORE UPDATE OF `status`, per row, when a version leaves `DRAFT`) | Copies each section's current subject name into `subject_name_snapshot` just before the version is frozen. A published test keeps the label it was published with. Drafts have no snapshot and show the current name (`COALESCE(subject_name_snapshot, subjects.name)`) |
| `guard_final_decision(open_status)` | `payment_submissions_decision_is_final` (`'SUBMITTED'`), `subscription_requests_decision_is_final` (`'PENDING'`) (BEFORE UPDATE OR DELETE, per row) | Once a row leaves its open status it is write-once: nothing but `updated_at` may change. No row can ever be deleted (payment and access evidence) |
| `validate_decision_correction()` | `decision_corrections_validate` (BEFORE INSERT, per row) | A correction must match the decision it corrects: an `*_APPROVAL_REVERSED` correction needs an `APPROVED` decision, and an `*_REJECTION_REVERSED` one a `REJECTED` decision. The period must belong to the same learner. `ACCESS_REVOKED` must reference the period that approval created (`source_request_id`), already `REVOKED`. `ACCESS_GRANTED` must reference a new `ACTIVE` period with no source request, activated by the correcting admin |
| `forbid_change()` | `audit_logs_append_only`, `decision_corrections_append_only` (BEFORE UPDATE OR DELETE, per row) | Append-only: rows can be inserted, never updated or deleted, by any role whose triggers are enabled (including the owner) |
| `guard_subscription_period()` | `subscription_periods_history_guard` (BEFORE UPDATE OR DELETE, per row) | Access periods are history. They are never deleted, and only `status`, `revoked_at` and `revocation_reason` can change. The only allowed moves are `ACTIVE → EXPIRED`, `ACTIVE → REVOKED` and `EXPIRED → REVOKED`. A revocation can't be changed or undone. The granted window, learner, plan, source request and activator never change |
| `require_correction_for_revocation()` | `subscription_periods_revocation_needs_correction` (constraint trigger, AFTER UPDATE OF `status`, `DEFERRABLE INITIALLY DEFERRED`) | At commit, a period that became `REVOKED` must be referenced by an `ACCESS_REVOKED` decision correction. Otherwise the whole transaction is refused. So access can't be revoked without a record of who did it and why |
| `forbid_truncate()` | `*_no_truncate` on `test_versions`, `test_version_sections`, `test_version_questions`, `payment_submissions`, `subscription_requests`, `subscription_periods`, `decision_corrections`, `audit_logs` (BEFORE TRUNCATE, per statement) | Row triggers don't fire on `TRUNCATE`. These triggers refuse it, including when reached through `TRUNCATE … CASCADE`. The app role has no TRUNCATE right at all; these triggers also stop the owner role |

Errors use SQLSTATE `23000` (`integrity_constraint_violation`).

### Partial unique indexes (10)

| Index | Allows at most one… |
|---|---|
| `subscription_requests_one_pending_per_user` | `PENDING` subscription request per learner |
| `tests_single_free_demo` | free demo test on the platform |
| `product_images_one_primary_per_product` | primary image per product |
| `carts_one_active_per_user` | `ACTIVE` cart per learner (older carts are kept) |
| `carts_one_active_per_guest` | `ACTIVE` cart per guest token (older carts are kept) |
| `test_attempts_one_in_progress_per_user` | `IN_PROGRESS` attempt per learner per test |
| `test_attempts_one_in_progress_per_guest` | `IN_PROGRESS` attempt per guest per test |
| `attempt_section_states_one_active_per_attempt` | active section per attempt |
| `admin_invitations_one_pending_per_email` | pending invitation per normalized email |
| `addresses_one_default_per_user` | default address per learner |

### CHECK constraints (42)

| Group | Constraints | Rule |
|---|---|---|
| Identity of the owner | `carts_exactly_one_owner_check`, `test_attempts_exactly_one_actor_check` | A cart and an attempt belong to exactly one of a learner or a guest token |
| Cart merge | `carts_merge_target_check` | `MERGED` exactly when `merged_into_cart_id` is set, and never the cart itself |
| Decisions | `subscription_requests_decision_check`, `subscription_requests_rejection_reason_check`, `payment_submissions_decision_check`, `payment_submissions_rejection_reason_check` | An approved or rejected row names the reviewer and time (§7.4); a rejection has a reason |
| Decision corrections | `decision_corrections_target_check`, `decision_corrections_access_effect_check`, `decision_corrections_reason_check` | A correction names exactly the kind of decision it targets: a subscription request or a payment submission. Its access effect fits its kind: approval reversed means `ACCESS_REVOKED`, rejection reversed means `ACCESS_GRANTED` or `NONE`, and a payment correction means `NONE`. It names a period exactly when it has an effect. The reason isn't blank |
| Access history | `subscription_periods_revocation_check` | A period is `REVOKED` exactly when `revoked_at` and `revocation_reason` are set |
| Subject labels | `test_version_sections_subject_snapshot_check` | A subject-name snapshot exists only on a section with a subject |
| Request history | `subscription_request_events_transition_check`, `subscription_request_events_rejection_reason_check` | An event changes the status; a rejection event has a reason |
| Accounts | `users_deactivation_check` | A `DEACTIVATED` account has `deactivated_at` |
| Section timers | `attempt_section_states_valid_state_check` | Time used is never negative; a locked section is never active |
| Security and idempotency | `auth_events_failure_reason_check`, `idempotency_records_completed_check`, `idempotency_records_response_status_check`, `idempotency_records_valid_times_check` | Failed sign-ins have a reason code. Completed idempotent requests store a response status (100–599) and a completion time. Expiry follows creation |
| Money | `subscription_plans_price_nonnegative_check`, `subscription_requests_amount_nonnegative_check`, `products_valid_price_check`, `orders_nonnegative_amounts_check`, `orders_total_check`, `order_items_valid_quantities_and_amounts_check`, `payment_submissions_amount_nonnegative_check`, `refund_records_amount_nonnegative_check` | Amounts in paise are never negative. Selling price ≤ MRP. Order total = subtotal + shipping − discount. Line total = unit price × quantity |
| Stock and carts | `inventory_balances_valid_quantity_check`, `stock_reservations_valid_quantity_check`, `cart_items_quantity_positive_check` | Stock is never negative, reserved ≤ on hand, and quantities are positive |
| Time and sizes | `subscription_plans_duration_positive_check`, `subscription_periods_valid_range_check`, `test_versions_valid_duration_check`, `test_version_sections_valid_values_check`, `test_attempts_valid_time_and_number_check`, `lesson_progress_valid_values_check`, `video_assets_valid_size_and_version_check`, `video_assets_valid_dimensions_check`, `video_processing_jobs_progress_check`, `video_upload_parts_positive_values_check`, `addresses_country_code_check` | Durations, sizes, versions and part numbers are positive. Ranges and percentages are valid. Country codes have two letters |

### Runtime-role privileges

The init script gives `studyverse_app` row access (`SELECT, INSERT, UPDATE, DELETE`) to every table the migrator creates, through `ALTER DEFAULT PRIVILEGES`. Part 2 ends with a `DO` block that narrows this:

| Table | `studyverse_app` | Why |
|---|---|---|
| `audit_logs`, `decision_corrections` | `SELECT, INSERT` | Append-only history |
| `subscription_periods`, `subscription_requests`, `payment_submissions` | `SELECT, INSERT, UPDATE` | Never deleted (evidence and access history) |
| `_prisma_migrations` | none | Migration bookkeeping belongs to the migrator alone |
| Every other table | `SELECT, INSERT, UPDATE, DELETE` | Unchanged |

So the app role is stopped twice: it lacks the privilege, and the triggers would refuse the change anyway.

`_prisma_migrations` already exists when the block runs, because Prisma creates it before applying the first migration. The block is skipped where the role doesn't exist, and it skips `_prisma_migrations` where that table doesn't exist (Prisma's shadow database). The catalog result is in "Runtime role privileges" at the end of this document.

### Who these rules stop (trust boundary)

These rules hold against:

- the API's role (`studyverse_app`);
- application bugs;
- accidental SQL.

They **don't** hold against the owner role (`studyverse_migrator`) or the PostgreSQL superuser. The owner can disable a trigger, replace a guard function or grant itself privileges. The superuser can also bypass privileges entirely. That is inherent to PostgreSQL, so those credentials are operational secrets:

- the owner role is used only by the migration job, never by the running API;
- the superuser is used only for administration.

Detecting tampering by those roles needs controls outside the database: restricted access to the credentials, DDL logging, and backups that preserve history. Those belong to the production-hardening phase. The API's role was verified unable to disable a trigger, drop a guard function, grant itself privileges, truncate a protected table, or touch `_prisma_migrations`. The full statement is in `prisma/README.md` ("Trust boundary").

### Other notable rules (in Part 1, from the schema)

- **Composite foreign key** `test_version_questions(section_id, test_version_id) → test_version_sections(id, test_version_id)`, `ON DELETE NO ACTION`: a question's section must belong to its own version. A section that still has questions can't be deleted. Deleting a draft version cascades to both.
- **Unique keys:**
  - `(user_id, test_id, attempt_number)` and `(guest_token_hash, test_id, attempt_number)` number attempts per actor and test;
  - `(order_id, product_id)` gives one reservation per order and product;
  - `(cart_id, product_id)` gives one cart line per book, which the merge upserts into;
  - `decision_corrections.subscription_request_id`, `.payment_submission_id` and `.subscription_period_id` allow at most one correction per decision and per period.

## 3. Foreign-key deletion policy

Accounts are deactivated, never hard-deleted by the application. Foreign keys make an accidental hard delete fail instead of erasing history.

| Area | Delete behaviour |
|---|---|
| **Financial** | **RESTRICT**: `orders.user_id`, `payment_submissions.order_id` and `.reviewed_by_id`, `decision_corrections.payment_submission_id`, `refund_records.order_id` and `.recorded_by_id`, `stock_reservations`, `inventory_movements.product_id` and `.actor_user_id`, `order_items.product_id`. Payment submissions and decided requests also can't be deleted at all (privilege and trigger) |
| **Access control and subscriptions** | **RESTRICT**: `subscription_requests.user_id` and `.reviewed_by_id`, `subscription_periods.user_id`, `.activated_by_id` and `.source_request_id`, `decision_corrections.subscription_request_id` and `.subscription_period_id`, `user_roles.assigned_by`, `user_permissions.granted_by_id`, `admin_invitations.invited_by_id`. **CASCADE**: a learner's own `user_roles` and `user_permissions` rows (current assignments, not history) |
| **Audit and history** | **RESTRICT**: `audit_logs.actor_user_id`, `decision_corrections.corrected_by_id`, `order_events.actor_user_id`, `subscription_request_events.actor_user_id`, `result_release_events.actor_user_id`, `cancellation_requests` and `return_requests` requester and reviewer, `test_attempts.user_id` |
| **Account-owned data** | **CASCADE**: credentials, OAuth links, auth tokens, user sessions, addresses, carts, notifications, lesson progress |
| **Incidental metadata** | **SET NULL** (16 in total). Links to users: course and video authorship, invitation acceptor, last settings editor, playback-session user, learner and session on auth events. Other links: course preview lesson, active video asset, last-watched asset, order address (the order keeps `address_snapshot`), product category and subject, refund → return request, question → bank source (refused anyway once published), test → active version |

Totals: 56 RESTRICT, 38 CASCADE, 16 SET NULL, 1 NO ACTION.

## 4. Behaviour verified, by area

All behaviour below was verified on **PostgreSQL 18.7**, by the suites in `apps/api/test/schema/*.int-spec.ts`. They run as the app role, against a database migrated from scratch by `prisma migrate deploy`. Owner-role cases run as the migrator. CI's `api` job runs them on every pull request.

| Area | What is tested |
|---|---|
| **Published test versions** | 20 kinds of change are refused on a published version: sections, order, subjects, timers, question assignment, answer keys, marking, timing, release mode, attempt limit, moving, reopening and deleting. Cascades from tests, subjects and the question bank are refused. TRUNCATE is refused for the owner role. Bank edits leave the snapshot unchanged. Releasing solutions and superseding work. Drafts are fully editable |
| **Published subject labels** | Drafts show the current subject name, and publication snapshots it. Renaming a subject afterwards doesn't relabel a published or superseded test, while a new version uses the new name. Section order and subject links stay intact. A published snapshot can't be changed, and a snapshot without a subject is refused |
| **Sections and section timers** | Sections are ordered, subject-linked and individually timed, with assigned questions. Cross-version assignment is refused. Covers time used, locking, one active section, and no section both locked and active |
| **Guest demo attempts and retakes** | Retakes are numbered per guest and test, and numbers can't repeat. Guests are independent. Guest attempts can be claimed and renumbered after a learner's own |
| **One active attempt** | One `IN_PROGRESS` attempt per learner, and per guest, per test. A retake after submission is allowed. Other tests are independent |
| **Subscription and payment decisions** | Reviewer, time and reason are required. Decided rows are write-once. No submission or request can be deleted: the app role has no privilege, and the trigger refuses the owner. TRUNCATE is refused. A resubmission keeps every decision. A reviewer can't be deleted. Request events follow their rules |
| **Decision corrections** | A wrong approval that already granted access is corrected: the period is revoked, who, when and why are recorded, and the original decision and the granted window stay intact. A revocation with no correction is refused at a real `COMMIT`. A correction must revoke the period that approval created, and its kind must match the original decision. One correction per decision, with a non-blank reason. A wrong rejection is corrected with a new period activated by the correcting admin, and the request stays `REJECTED`. A payment correction is a record only: no access change, and the payment decision is untouched. Corrections are append-only for the app role (privilege) and the owner (trigger). A period's window, learner and source never change. The allowed status moves are enforced, and a revocation is final |
| **Audit logs** | Tested as the real roles. The app role inserts an entry and can read it, but is refused UPDATE, DELETE and TRUNCATE. The owner is refused by the trigger. The app role can't disable the trigger, drop the function or grant itself privileges. The entry is byte-for-byte unchanged afterwards. Its actor can't be deleted |
| **Migration bookkeeping** | `_prisma_migrations` is owned by the migrator. The app role can't read, insert, update, delete or truncate it. The migrator still reads it, and `migrate deploy` and `migrate status` keep working |
| **Stock reservations** | Reserved can never exceed on hand, even with an unguarded update. One reservation per order and product. Of two concurrent reservations of the last copy, exactly one succeeds (two real sessions, the second verified blocked) |
| **Cart merging** | One active cart per guest and per learner. History is kept, and `MERGED` stays consistent. The larger quantity wins. A retry changes nothing. A concurrent double merge waits, then does nothing. A failed merge rolls back fully |
| **Actor references** | RESTRICT on actors blocks hard deletes (audit logs, decisions, corrections, role grants, attempts, orders, subscriptions). Deactivation leaves all history in place |
| **Migration workflow** | One migration is applied completely, and a second deploy is a no-op. `migrate status` is up to date, with no drift. Every custom index, CHECK, trigger and function is present. Every table is owned by the migrator, and the app role has exactly the privilege set intended for each table |

## 5. PostgreSQL 18.7 test commands and results

**Environment.**

- The **official `postgres:18.7-trixie` image**, started with `infra/compose.yaml` from an empty volume, on Docker Desktop (linux/arm64). `select version()`: `PostgreSQL 18.7 (Debian 18.7-1.pgdg13+5)`.
- The image's entrypoint ran `infra/postgres/init/01-roles-and-databases.sh` with its real `psql`.
- The tests and the Prisma CLI ran on Node **22.23.5**, the official build, SHA-256 verified.

(An earlier revision of this document reported results from PostgreSQL 18.7 binaries outside Docker, with a stand-in for `psql`, because Docker wasn't responding at the time. All the results below come from the container.)

**Migration workflow in containers** (Compose `app` profile, with a fresh project and fresh generated passwords):

| Step | Result |
|---|---|
| `docker compose up -d --wait postgres` | Healthy. The log shows `running /docker-entrypoint-initdb.d/01-roles-and-databases.sh`, then `studyverse roles and databases created` |
| Roles | `studyverse_migrator` and `studyverse_app`: not superuser, no CREATEDB, no CREATEROLE. `studyverse`, `studyverse_test` and `studyverse_shadow` are owned by the migrator, with no PUBLIC connect. The default privileges give the app role `arwd` on tables and `rU` on sequences |
| `docker compose --profile app up -d --build --wait api` | Both images built. The `migrate` container printed `Applying migration 20261125070533_init`, then `All migrations have been successfully applied.`, and exited 0. The API then became healthy |
| `docker compose run --rm migrate` (second deploy) | `No pending migrations to apply.`, exit 0 |
| `prisma migrate status` in the migrator image | `Database schema is up to date!` |
| Catalog of the migrated `studyverse` database | 70 tables, all owned by `studyverse_migrator`. App-role privileges as in section 2 |
| App role, `psql` in the container: `DELETE`/`TRUNCATE audit_logs`, `UPDATE`/`SELECT _prisma_migrations` | Each refused with `permission denied for table …` |

The first build attempt failed with `ECONNRESET` while `@prisma/engines` downloaded its engine binaries during `npm ci`. A direct download of the same engine from a container then took 2.3 s, and the retry built cleanly, so this was a transient network error. If it recurs in CI, the fix is a build retry or a cached engine, not a Dockerfile change.

**Migration workflow, Prisma commands** (from `apps/api`, with the migrator URL):

| Command | Result |
|---|---|
| `npm run db:initial-migration -- --check` | `20261125070533_init/migration.sql is reproducible from the repository.` |
| `npx prisma migrate deploy` (as the integration global setup, on an emptied `studyverse_test`) | Applied |
| `npx prisma migrate deploy` (again) | `No pending migrations to apply.` |
| `npx prisma migrate status` | `Database schema is up to date!` |
| `npx prisma migrate diff --from-config-datasource --to-schema ../../prisma/schema.prisma --script --exit-code` | Exit 0, `-- This is an empty migration.` (no drift) |
| `npx prisma migrate dev --create-only` (shadow database `studyverse_shadow`, same image, an earlier throwaway Compose project) | Only an empty migration, so the history replayed in the shadow database matches the schema, `DO` block included. The empty migration was deleted |

**Rollback verification** (26 November 2026, at the migration committed in `e92be6d`).

The test environment was a disposable `postgres:18.7-trixie` container with no named volume, removed afterwards:

```bash
docker run -d --rm --name sv-rollback-probe --env-file pg.env -p 127.0.0.1:55433:5432 \
  -v "$PWD/infra/postgres/init:/docker-entrypoint-initdb.d:ro" postgres:18.7-trixie \
  -c log_statement=all -c log_min_messages=notice \
  -c "log_line_prefix=%m [%p] %u@%d vxid=%v xid=%x "
```

The init script ran through the image's entrypoint. Every run used `studyverse_migrator`, a role that isn't a superuser, against databases inside that container.

The *broken migration* is a scratch copy of the committed migration with 12 lines added just before `COMMIT;`, and was never committed:

- a `DO` block that reports which objects exist and `pg_current_xact_id_if_assigned()`. That function returns NULL under autocommit, and a transaction ID only if earlier statements of the same transaction already wrote;
- then a deliberate failure: `CREATE TABLE "users" ("id" INTEGER);`.

The error message itself proves that the earlier `CREATE TABLE "users"` had run.

| Step | Result |
|---|---|
| `psql -h 127.0.0.1 -U studyverse_migrator -d final_psql -v ON_ERROR_STOP=1 --no-psqlrc -q -f broken.sql` | The server log shows one backend and one virtual transaction ID (`57/2`) for all 431 statements, starting with `BEGIN;`. The probe reported `69 public tables, 19 triggers, 9 functions exist; transaction id already assigned by earlier statements: 877`. Then `ERROR: relation "users" already exists`. No `COMMIT` was executed, and psql exited 3 |
| Then, in `final_psql` | 0 tables, enums, functions, triggers, indexes or relations in `public`. `pg_xact_status(877)` = `aborted` |
| `prisma migrate deploy` with the broken migration, on `final_prisma` | Prisma sent the script as one message. The probe reported 70 tables (Prisma's `_prisma_migrations` plus 69) and the same `ERROR: relation "users" already exists`. Prisma's next statement, `UPDATE "_prisma_migrations" SET "logs" = …`, failed with `current transaction is aborted`, and that is the error Prisma printed. Exit 1 |
| Then, in `final_prisma` | Only `_prisma_migrations` remains: 0 enums, CHECKs, functions, triggers or partial indexes. Its row for the attempt is started, not finished, not rolled back, with `logs` empty. Prisma inserts that row in its own transaction before it runs the migration. The migration's transaction is `aborted` |
| `prisma migrate deploy` again | `Error: P3009 migrate found failed migrations in the target database`, exit 1 |
| `prisma migrate resolve --rolled-back 20261125070533_init` | `marked as rolled back`, exit 0 |
| `prisma migrate deploy` with the committed migration | `All migrations have been successfully applied.`, exit 0. Result: 70 tables, 45 enums, 42 CHECKs, 9 functions, 19 triggers, 10 partial unique indexes. `_prisma_migrations` keeps the failed attempt (rolled back) and the successful one (finished) |
| `prisma migrate status`, second deploy | `Database schema is up to date!`, `No pending migrations to apply.` |
| A later migration on top, `20261126000000_followup_probe` (scratch: `BEGIN; CREATE TABLE …; COMMIT;`) | Applied, and `migrate status` is up to date |
| An earlier run of the same sequence on the init-created `studyverse` database. It used the migration before `e92be6d`, which differs only in its header comment | Same results. The app role ended with no access to `_prisma_migrations`, and `SELECT, INSERT` on `audit_logs` |

**Comparisons, on scratch databases in the same container:**

| Script | How Prisma sent it | Result |
|---|---|---|
| The broken migration **without** `BEGIN`/`COMMIT` | One message | Also rolled back, by the implicit transaction. Prisma reported the cause (`P3018`, `42P07 relation "users" already exists`) and stored it in `logs` |
| `CREATE TABLE "probe_before_error" …; SELECT 1/0;` | Two statements, two transactions | The table stayed after the failure |
| The same, with a `DO $$ … $$` block between them | One message | Nothing stayed |
| The same two statements wrapped in `BEGIN`/`COMMIT` | Four statements, one transaction | Nothing stayed. Exit 1, with the misleading `current transaction is aborted` |

What this shows:

- **Atomicity.** Without the wrapper, whether a migration is atomic depends on how Prisma happens to send its script. With the wrapper, it always is.
- **The trade-off.** A wrapped failure is reported misleadingly. The operator reads the cause from the PostgreSQL log, as described in `prisma/README.md` ("Migration policy").

**Test suites** at commit `9140c08` (Node 22.23.5, npm 10.9.9). The integration and unit suites were re-run on the regenerated migration at `e92be6d`, and the counts were the same:

| Command | Result |
|---|---|
| `npm run test:integration`, with `TEST_DATABASE_URL` (app role) and `TEST_DATABASE_MIGRATION_URL` (migrator) pointing at the container's `studyverse_test` | **130 passed**, 0 failed, 13 files |
| `npm test` | **77 passed**, 0 failed |
| `npm run lint` / `format:check` / `typecheck` / `db:validate` / `build` | All exit 0. Lint reports no findings |

The final branch head is verified again from a clean install in the pull request description.

## 6. Container verification (Docker)

Run on real containers with Docker Desktop, using the Compose stack in `infra/compose.yaml` and the `app` profile. Throwaway project, fresh volume and freshly generated passwords. Nothing was replayed outside Docker.

| Check | Result |
|---|---|
| PostgreSQL container starts | `postgres:18.7-trixie`, healthy, bound to `127.0.0.1` only |
| The init script runs with real `psql` | Yes, from the official entrypoint (section 5) |
| Roles and permissions | As intended (section 5) |
| The migration job completes | `migrate` exited 0. A second run is a no-op |
| The API image builds | Yes. Runtime image 121 MB. Migrator image 405 MB (it carries the Prisma CLI and the migrations) |
| The API starts and becomes ready | Container `healthy`. `/api/v1/health/live` returns 200, and `/api/v1/health/ready` returns 200 with `database: up`. An unknown route returns a Problem Details 404. `/api/docs` returns 404 because Swagger is off in production |
| The API connects as the restricted role | The only database connection from the API container's address is `studyverse_app` |
| Image hardening | Runs as `node` (uid 1000). It contains only `dist`, production `node_modules` and `package.json`: no source, no Prisma CLI. Its files can't be written (`touch /app/x` → permission denied). The root filesystem is read-only, all capabilities are dropped, and `no-new-privileges` is set |
| No secrets in the image | No `.env`, `.env.*`, `*.pem` or key files. The image environment has only `PATH`, `NODE_VERSION`, `YARN_VERSION`, `NODE_ENV`, `HOST` and `PORT`. None of the generated passwords appear in `docker history`, image config or build output. (No local `.env` files existed to leak) |
| No secrets in logs | None of the three passwords, the word "password" or a connection URL appears in any container's logs |
| Graceful shutdown | `docker stop`: 0.2 s, exit code 0. The log shows `Received SIGTERM; shutting down`, then `Shutdown complete`, 9 ms apart. PID 1 is `node`. Afterwards no `studyverse_app` connection remains, and PostgreSQL logged no unexpected disconnects. `docker compose stop api` after a restart: 0.24 s, exit 0 |

**Still unverified:** GitHub Actions. The workflows (`backend-tests.yml` with its `api` and `container` jobs) run on a pull request into `develop`, and their results are reported on that pull request.

## 7. Limitations, deferred decisions and risks

1. **Refunds aren't defined.** A payment correction is a record only: it changes no order, stock, refund or access record. What happens to the order and the money is a bookstore policy decision, documented as open in `prisma/README.md` ("Correcting payment and subscription decisions").
2. **Corrections have deliberate limits.** At most one correction per decision, so correcting a correction needs a separately designed process. Renewal periods stacked after a revoked period keep their dates. The audit-log entry for a correction is written by the service in the same transaction, but the database doesn't require it; the database does require the correction record.
3. **Trust boundary.** The triggers stop the API's role, application bugs and accidents, not whoever holds the owner or superuser credentials (section 2). Tamper detection belongs to production hardening.
4. **New tables get full row access by default.** The init script's default privileges give the app role `SELECT, INSERT, UPDATE, DELETE` on every new table. A future migration that adds history must revoke what it shouldn't have, as Part 2 does. The privilege test in `schema/migration.int-spec.ts` pins the table count and each table's privilege set, so every new table fails it until someone reviews its privileges and updates the test. The `DO` block names the role `studyverse_app`: a deployment that uses another role name skips it and must apply the same revokes.
5. **Rules the database can't enforce** stay in services and must be tested there:
   - a preview lesson, active video asset or active test version belongs to its parent;
   - an attempt's question and section states belong to the attempt's version;
   - every section of a section-timed version has a duration;
   - the guest-attempt claim and cart-merge procedures.

   See "Invariants enforced in application services" in `prisma/README.md`.
6. **The database enforces deactivation only for history.** Refusing sign-in, revoking sessions and invalidating tokens are Milestone 2 requirements (listed in `prisma/README.md`).
7. **Personal-data retention is deferred.** Deactivation isn't deletion. A retention and deletion policy is required before production. Nothing deletes or anonymizes data automatically.
8. **Test titles aren't snapshotted.** Subject names on published sections are. Renaming a test changes how its past attempts are labelled; their content, sections and subject labels don't change.
9. **Every future migration must include `BEGIN`/`COMMIT`.** The convention is documented, but a test checks it for the initial migration only. When a wrapped migration fails, Prisma reports `current transaction is aborted` instead of the cause. Operators read the cause from the PostgreSQL log (`prisma/README.md`, "Migration policy").
10. **Return requests aren't write-once.** Deleting one would set `refund_records.return_request_id` to NULL. Deferred to the bookstore milestone, where return workflows are designed.
11. **Node 22 reaches end of life on 30 April 2027.** Plan the move to Node 24 before production.
12. **The `app` Compose profile migrates the local `studyverse` database.** Don't run it against data you want to keep until this migration is approved.

## 8. Inventory

<!-- generated:inventory:start (PostgreSQL 18.7; do not edit by hand) -->

Generated from the catalog of a database migrated with `20261125070533_init` on PostgreSQL 18.7 (the official `postgres:18.7-trixie` image, migrated by the Compose `migrate` job).

| Object | Count |
|---|---|
| Tables (plus `_prisma_migrations`) | 69 |
| Enums | 45 |
| Foreign keys | 111 (56 RESTRICT, 38 CASCADE, 16 SET NULL, 1 NO ACTION) |
| Indexes | 211: 69 primary keys, 52 unique, 10 partial unique, 80 non-unique |
| CHECK constraints | 42 |
| Triggers | 19 (1 deferred constraint trigger) |
| Functions | 9 |

### Tables

| Table | Columns |
|---|---|
| `addresses` | 16 |
| `admin_invitations` | 11 |
| `attempt_question_states` | 8 |
| `attempt_results` | 9 |
| `attempt_section_states` | 8 |
| `audit_logs` | 9 |
| `auth_events` | 12 |
| `auth_tokens` | 7 |
| `cancellation_requests` | 9 |
| `cart_items` | 6 |
| `carts` | 8 |
| `course_exam_categories` | 2 |
| `course_modules` | 7 |
| `course_subjects` | 2 |
| `courses` | 13 |
| `decision_corrections` | 9 |
| `exam_categories` | 7 |
| `hls_packages` | 8 |
| `idempotency_records` | 14 |
| `inventory_balances` | 7 |
| `inventory_movements` | 9 |
| `lesson_progress` | 11 |
| `lesson_resources` | 13 |
| `lessons` | 11 |
| `notifications` | 11 |
| `oauth_accounts` | 8 |
| `order_events` | 7 |
| `order_items` | 11 |
| `orders` | 18 |
| `outbox_events` | 12 |
| `payment_submissions` | 12 |
| `permissions` | 4 |
| `playback_sessions` | 9 |
| `product_images` | 7 |
| `products` | 20 |
| `question_bank_items` | 8 |
| `question_bank_options` | 6 |
| `refund_records` | 11 |
| `result_release_events` | 6 |
| `return_requests` | 11 |
| `role_permissions` | 3 |
| `roles` | 6 |
| `shipments` | 10 |
| `stock_reservations` | 10 |
| `store_settings` | 5 |
| `subjects` | 6 |
| `subscription_periods` | 11 |
| `subscription_plans` | 9 |
| `subscription_request_events` | 8 |
| `subscription_requests` | 17 |
| `test_attempts` | 13 |
| `test_courses` | 2 |
| `test_exam_categories` | 2 |
| `test_subjects` | 2 |
| `test_version_questions` | 11 |
| `test_version_sections` | 8 |
| `test_versions` | 13 |
| `tests` | 11 |
| `user_credentials` | 6 |
| `user_permissions` | 5 |
| `user_roles` | 4 |
| `user_sessions` | 9 |
| `users` | 12 |
| `video_assets` | 25 |
| `video_processing_attempts` | 13 |
| `video_processing_jobs` | 18 |
| `video_renditions` | 13 |
| `video_upload_parts` | 6 |
| `video_upload_sessions` | 12 |

### Enums

| Enum | Values |
|---|---|
| `AttemptStatus` | IN_PROGRESS, SUBMITTED, AUTO_SUBMITTED, ABANDONED |
| `AuditActorType` | USER, SYSTEM |
| `AuthEventType` | ACCOUNT_REGISTERED, LOGIN_SUCCEEDED, LOGIN_FAILED, LOGOUT, SESSION_REVOKED, ALL_SESSIONS_REVOKED, PASSWORD_CHANGED, PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED, EMAIL_VERIFICATION_SENT, EMAIL_VERIFIED, OAUTH_ACCOUNT_LINKED, OAUTH_ACCOUNT_UNLINKED, ACCOUNT_SUSPENDED, ACCOUNT_REACTIVATED |
| `AuthMethod` | PASSWORD, GOOGLE |
| `AuthTokenPurpose` | EMAIL_VERIFICATION, PASSWORD_RESET |
| `CancellationRequestStatus` | REQUESTED, APPROVED, REJECTED, COMPLETED |
| `CartStatus` | ACTIVE, CONVERTED, ABANDONED, MERGED |
| `CorrectionAccessEffect` | NONE, ACCESS_REVOKED, ACCESS_GRANTED |
| `CourseStatus` | DRAFT, PUBLISHED, ARCHIVED |
| `DecisionCorrectionKind` | SUBSCRIPTION_APPROVAL_REVERSED, SUBSCRIPTION_REJECTION_REVERSED, PAYMENT_APPROVAL_REVERSED, PAYMENT_REJECTION_REVERSED |
| `HlsPackageStatus` | STAGING, VERIFYING, VERIFIED, FAILED, RETIRED |
| `IdempotencyStatus` | IN_PROGRESS, COMPLETED |
| `InventoryMovementType` | STOCK_ADDED, DAMAGED_REMOVED, CORRECTION, RESERVED, RESERVATION_RELEASED, SOLD, RETURNED, REPLACEMENT_ISSUED |
| `InvitationStatus` | PENDING, ACCEPTED, EXPIRED, REVOKED |
| `LessonResourceType` | PDF, NOTE, WORKSHEET, LINK, OTHER |
| `LessonStatus` | DRAFT, PUBLISHED, ARCHIVED |
| `NotificationChannel` | IN_APP, EMAIL |
| `NotificationStatus` | PENDING, SENT, FAILED, READ |
| `OAuthProvider` | GOOGLE |
| `OrderStatus` | PENDING_PAYMENT, PAYMENT_VERIFICATION, PAYMENT_CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, RETURNED, REFUNDED |
| `OutboxEventStatus` | PENDING, DISPATCHED, FAILED |
| `PaymentMethod` | UPI, BANK_TRANSFER, OTHER |
| `PaymentSubmissionStatus` | SUBMITTED, APPROVED, REJECTED |
| `PermissionEffect` | ALLOW, DENY |
| `PlaybackAccessType` | PREVIEW, SUBSCRIPTION |
| `ProcessingAttemptOutcome` | RUNNING, SUCCEEDED, RETRYABLE_FAILURE, PERMANENT_FAILURE, CANCELLED |
| `ProductStatus` | DRAFT, PUBLISHED, ARCHIVED |
| `QuestionType` | SINGLE_CHOICE, MULTI_SELECT, NUMERICAL |
| `RefundStatus` | PENDING, COMPLETED, FAILED |
| `ResultReleaseAction` | RELEASED, WITHHELD |
| `ResultReleaseMode` | IMMEDIATE, MANUAL |
| `ReturnRequestStatus` | REQUESTED, UNDER_REVIEW, APPROVED, REJECTED, REPLACEMENT_IN_PROGRESS, REFUND_IN_PROGRESS, RESOLVED |
| `ShipmentStatus` | PROCESSING, SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, DELIVERY_FAILED, RETURNED_TO_SENDER |
| `StockReservationStatus` | ACTIVE, HELD_FOR_VERIFICATION, CONSUMED, RELEASED, EXPIRED |
| `SubscriptionPeriodStatus` | ACTIVE, EXPIRED, REVOKED |
| `SubscriptionRequestStatus` | PENDING, APPROVED, REJECTED, CANCELLED |
| `TestKind` | FULL, SECTIONAL, CHAPTER, PRACTICE |
| `TestStatus` | DRAFT, PUBLISHED, ARCHIVED |
| `TestTimingMode` | OVERALL, SECTION |
| `TestVersionStatus` | DRAFT, PUBLISHED, SUPERSEDED |
| `UserStatus` | ACTIVE, SUSPENDED, PENDING_DELETION, DEACTIVATED |
| `VideoAssetStatus` | UPLOAD_PENDING, UPLOADED, PROCESSING, READY, PROCESSING_FAILED, SUPERSEDED, QUARANTINED, UPLOAD_EXPIRED, REJECTED |
| `VideoProcessingJobStatus` | QUEUED, RUNNING, RETRY_WAIT, CANCEL_REQUESTED, SUCCEEDED, FAILED_PERMANENT, CANCELLED |
| `VideoProcessingStage` | VALIDATE_SOURCE, DOWNLOAD_SOURCE, PROBE_SOURCE, TRANSCODE_HLS, UPLOAD_HLS_STAGING, VERIFY_HLS, ARCHIVE_MASTER, VERIFY_ARCHIVE, COMMIT_ASSET_READY, CLEANUP_TEMPORARY_FILES |
| `VideoUploadSessionStatus` | INITIATED, UPLOADING, COMPLETING, COMPLETED, ABORTED, EXPIRED, FAILED |

### Foreign keys

| Table | Constraint | References | On delete |
|---|---|---|---|
| `addresses` | `addresses_user_id_fkey` | `users` (user_id → id) | CASCADE |
| `admin_invitations` | `admin_invitations_accepted_by_id_fkey` | `users` (accepted_by_id → id) | SET NULL |
| `admin_invitations` | `admin_invitations_invited_by_id_fkey` | `users` (invited_by_id → id) | RESTRICT |
| `attempt_question_states` | `attempt_question_states_attempt_id_fkey` | `test_attempts` (attempt_id → id) | CASCADE |
| `attempt_question_states` | `attempt_question_states_test_version_question_id_fkey` | `test_version_questions` (test_version_question_id → id) | RESTRICT |
| `attempt_results` | `attempt_results_attempt_id_fkey` | `test_attempts` (attempt_id → id) | CASCADE |
| `attempt_section_states` | `attempt_section_states_attempt_id_fkey` | `test_attempts` (attempt_id → id) | CASCADE |
| `attempt_section_states` | `attempt_section_states_section_id_fkey` | `test_version_sections` (section_id → id) | RESTRICT |
| `audit_logs` | `audit_logs_actor_user_id_fkey` | `users` (actor_user_id → id) | RESTRICT |
| `auth_events` | `auth_events_user_id_fkey` | `users` (user_id → id) | SET NULL |
| `auth_events` | `auth_events_user_session_id_fkey` | `user_sessions` (user_session_id → id) | SET NULL |
| `auth_tokens` | `auth_tokens_user_id_fkey` | `users` (user_id → id) | CASCADE |
| `cancellation_requests` | `cancellation_requests_order_id_fkey` | `orders` (order_id → id) | RESTRICT |
| `cancellation_requests` | `cancellation_requests_requested_by_id_fkey` | `users` (requested_by_id → id) | RESTRICT |
| `cancellation_requests` | `cancellation_requests_reviewed_by_id_fkey` | `users` (reviewed_by_id → id) | RESTRICT |
| `cart_items` | `cart_items_cart_id_fkey` | `carts` (cart_id → id) | CASCADE |
| `cart_items` | `cart_items_product_id_fkey` | `products` (product_id → id) | RESTRICT |
| `carts` | `carts_merged_into_cart_id_fkey` | `carts` (merged_into_cart_id → id) | RESTRICT |
| `carts` | `carts_user_id_fkey` | `users` (user_id → id) | CASCADE |
| `course_exam_categories` | `course_exam_categories_course_id_fkey` | `courses` (course_id → id) | CASCADE |
| `course_exam_categories` | `course_exam_categories_exam_category_id_fkey` | `exam_categories` (exam_category_id → id) | RESTRICT |
| `course_modules` | `course_modules_course_id_fkey` | `courses` (course_id → id) | CASCADE |
| `courses` | `courses_created_by_id_fkey` | `users` (created_by_id → id) | SET NULL |
| `courses` | `courses_preview_lesson_id_fkey` | `lessons` (preview_lesson_id → id) | SET NULL |
| `course_subjects` | `course_subjects_course_id_fkey` | `courses` (course_id → id) | CASCADE |
| `course_subjects` | `course_subjects_subject_id_fkey` | `subjects` (subject_id → id) | RESTRICT |
| `decision_corrections` | `decision_corrections_corrected_by_id_fkey` | `users` (corrected_by_id → id) | RESTRICT |
| `decision_corrections` | `decision_corrections_payment_submission_id_fkey` | `payment_submissions` (payment_submission_id → id) | RESTRICT |
| `decision_corrections` | `decision_corrections_subscription_period_id_fkey` | `subscription_periods` (subscription_period_id → id) | RESTRICT |
| `decision_corrections` | `decision_corrections_subscription_request_id_fkey` | `subscription_requests` (subscription_request_id → id) | RESTRICT |
| `hls_packages` | `hls_packages_video_asset_id_fkey` | `video_assets` (video_asset_id → id) | CASCADE |
| `inventory_balances` | `inventory_balances_product_id_fkey` | `products` (product_id → id) | RESTRICT |
| `inventory_movements` | `inventory_movements_actor_user_id_fkey` | `users` (actor_user_id → id) | RESTRICT |
| `inventory_movements` | `inventory_movements_product_id_fkey` | `products` (product_id → id) | RESTRICT |
| `lesson_progress` | `lesson_progress_last_video_asset_id_fkey` | `video_assets` (last_video_asset_id → id) | SET NULL |
| `lesson_progress` | `lesson_progress_lesson_id_fkey` | `lessons` (lesson_id → id) | CASCADE |
| `lesson_progress` | `lesson_progress_user_id_fkey` | `users` (user_id → id) | CASCADE |
| `lesson_resources` | `lesson_resources_lesson_id_fkey` | `lessons` (lesson_id → id) | CASCADE |
| `lessons` | `lessons_active_video_asset_id_fkey` | `video_assets` (active_video_asset_id → id) | SET NULL |
| `lessons` | `lessons_module_id_fkey` | `course_modules` (module_id → id) | CASCADE |
| `notifications` | `notifications_user_id_fkey` | `users` (user_id → id) | CASCADE |
| `oauth_accounts` | `oauth_accounts_user_id_fkey` | `users` (user_id → id) | CASCADE |
| `order_events` | `order_events_actor_user_id_fkey` | `users` (actor_user_id → id) | RESTRICT |
| `order_events` | `order_events_order_id_fkey` | `orders` (order_id → id) | CASCADE |
| `order_items` | `order_items_order_id_fkey` | `orders` (order_id → id) | CASCADE |
| `order_items` | `order_items_product_id_fkey` | `products` (product_id → id) | RESTRICT |
| `orders` | `orders_address_id_fkey` | `addresses` (address_id → id) | SET NULL |
| `orders` | `orders_user_id_fkey` | `users` (user_id → id) | RESTRICT |
| `payment_submissions` | `payment_submissions_order_id_fkey` | `orders` (order_id → id) | RESTRICT |
| `payment_submissions` | `payment_submissions_reviewed_by_id_fkey` | `users` (reviewed_by_id → id) | RESTRICT |
| `playback_sessions` | `playback_sessions_lesson_id_fkey` | `lessons` (lesson_id → id) | RESTRICT |
| `playback_sessions` | `playback_sessions_user_id_fkey` | `users` (user_id → id) | SET NULL |
| `playback_sessions` | `playback_sessions_video_asset_id_fkey` | `video_assets` (video_asset_id → id) | RESTRICT |
| `product_images` | `product_images_product_id_fkey` | `products` (product_id → id) | CASCADE |
| `products` | `products_exam_category_id_fkey` | `exam_categories` (exam_category_id → id) | SET NULL |
| `products` | `products_subject_id_fkey` | `subjects` (subject_id → id) | SET NULL |
| `question_bank_options` | `question_bank_options_question_id_fkey` | `question_bank_items` (question_id → id) | CASCADE |
| `refund_records` | `refund_records_order_id_fkey` | `orders` (order_id → id) | RESTRICT |
| `refund_records` | `refund_records_recorded_by_id_fkey` | `users` (recorded_by_id → id) | RESTRICT |
| `refund_records` | `refund_records_return_request_id_fkey` | `return_requests` (return_request_id → id) | SET NULL |
| `result_release_events` | `result_release_events_actor_user_id_fkey` | `users` (actor_user_id → id) | RESTRICT |
| `result_release_events` | `result_release_events_test_version_id_fkey` | `test_versions` (test_version_id → id) | RESTRICT |
| `return_requests` | `return_requests_order_id_fkey` | `orders` (order_id → id) | RESTRICT |
| `return_requests` | `return_requests_requested_by_id_fkey` | `users` (requested_by_id → id) | RESTRICT |
| `return_requests` | `return_requests_reviewed_by_id_fkey` | `users` (reviewed_by_id → id) | RESTRICT |
| `role_permissions` | `role_permissions_permission_id_fkey` | `permissions` (permission_id → id) | CASCADE |
| `role_permissions` | `role_permissions_role_id_fkey` | `roles` (role_id → id) | CASCADE |
| `shipments` | `shipments_order_id_fkey` | `orders` (order_id → id) | RESTRICT |
| `stock_reservations` | `stock_reservations_order_id_fkey` | `orders` (order_id → id) | RESTRICT |
| `stock_reservations` | `stock_reservations_product_id_fkey` | `products` (product_id → id) | RESTRICT |
| `store_settings` | `store_settings_updated_by_id_fkey` | `users` (updated_by_id → id) | SET NULL |
| `subscription_periods` | `subscription_periods_activated_by_id_fkey` | `users` (activated_by_id → id) | RESTRICT |
| `subscription_periods` | `subscription_periods_plan_id_fkey` | `subscription_plans` (plan_id → id) | RESTRICT |
| `subscription_periods` | `subscription_periods_source_request_id_fkey` | `subscription_requests` (source_request_id → id) | RESTRICT |
| `subscription_periods` | `subscription_periods_user_id_fkey` | `users` (user_id → id) | RESTRICT |
| `subscription_request_events` | `subscription_request_events_actor_user_id_fkey` | `users` (actor_user_id → id) | RESTRICT |
| `subscription_request_events` | `subscription_request_events_request_id_fkey` | `subscription_requests` (request_id → id) | RESTRICT |
| `subscription_requests` | `subscription_requests_plan_id_fkey` | `subscription_plans` (plan_id → id) | RESTRICT |
| `subscription_requests` | `subscription_requests_reviewed_by_id_fkey` | `users` (reviewed_by_id → id) | RESTRICT |
| `subscription_requests` | `subscription_requests_user_id_fkey` | `users` (user_id → id) | RESTRICT |
| `test_attempts` | `test_attempts_test_id_fkey` | `tests` (test_id → id) | RESTRICT |
| `test_attempts` | `test_attempts_test_version_id_fkey` | `test_versions` (test_version_id → id) | RESTRICT |
| `test_attempts` | `test_attempts_user_id_fkey` | `users` (user_id → id) | RESTRICT |
| `test_courses` | `test_courses_course_id_fkey` | `courses` (course_id → id) | RESTRICT |
| `test_courses` | `test_courses_test_id_fkey` | `tests` (test_id → id) | CASCADE |
| `test_exam_categories` | `test_exam_categories_exam_category_id_fkey` | `exam_categories` (exam_category_id → id) | RESTRICT |
| `test_exam_categories` | `test_exam_categories_test_id_fkey` | `tests` (test_id → id) | CASCADE |
| `tests` | `tests_active_version_id_fkey` | `test_versions` (active_version_id → id) | SET NULL |
| `test_subjects` | `test_subjects_subject_id_fkey` | `subjects` (subject_id → id) | RESTRICT |
| `test_subjects` | `test_subjects_test_id_fkey` | `tests` (test_id → id) | CASCADE |
| `test_version_questions` | `test_version_questions_section_id_test_version_id_fkey` | `test_version_sections` (section_id, test_version_id → id, test_version_id) | NO ACTION |
| `test_version_questions` | `test_version_questions_source_question_id_fkey` | `question_bank_items` (source_question_id → id) | SET NULL |
| `test_version_questions` | `test_version_questions_test_version_id_fkey` | `test_versions` (test_version_id → id) | CASCADE |
| `test_versions` | `test_versions_test_id_fkey` | `tests` (test_id → id) | RESTRICT |
| `test_version_sections` | `test_version_sections_subject_id_fkey` | `subjects` (subject_id → id) | RESTRICT |
| `test_version_sections` | `test_version_sections_test_version_id_fkey` | `test_versions` (test_version_id → id) | CASCADE |
| `user_credentials` | `user_credentials_user_id_fkey` | `users` (user_id → id) | CASCADE |
| `user_permissions` | `user_permissions_granted_by_id_fkey` | `users` (granted_by_id → id) | RESTRICT |
| `user_permissions` | `user_permissions_permission_id_fkey` | `permissions` (permission_id → id) | CASCADE |
| `user_permissions` | `user_permissions_user_id_fkey` | `users` (user_id → id) | CASCADE |
| `user_roles` | `user_roles_assigned_by_fkey` | `users` (assigned_by → id) | RESTRICT |
| `user_roles` | `user_roles_role_id_fkey` | `roles` (role_id → id) | RESTRICT |
| `user_roles` | `user_roles_user_id_fkey` | `users` (user_id → id) | CASCADE |
| `user_sessions` | `user_sessions_user_id_fkey` | `users` (user_id → id) | CASCADE |
| `video_assets` | `video_assets_created_by_id_fkey` | `users` (created_by_id → id) | SET NULL |
| `video_assets` | `video_assets_lesson_id_fkey` | `lessons` (lesson_id → id) | RESTRICT |
| `video_processing_attempts` | `video_processing_attempts_job_id_fkey` | `video_processing_jobs` (job_id → id) | CASCADE |
| `video_processing_jobs` | `video_processing_jobs_video_asset_id_fkey` | `video_assets` (video_asset_id → id) | CASCADE |
| `video_renditions` | `video_renditions_hls_package_id_fkey` | `hls_packages` (hls_package_id → id) | CASCADE |
| `video_upload_parts` | `video_upload_parts_upload_session_id_fkey` | `video_upload_sessions` (upload_session_id → id) | CASCADE |
| `video_upload_sessions` | `video_upload_sessions_video_asset_id_fkey` | `video_assets` (video_asset_id → id) | CASCADE |

### Indexes

| Table | Index | Definition |
|---|---|---|
| `addresses` | `addresses_one_default_per_user` | UNIQUE (user_id) WHERE (is_default = true) |
| `addresses` | `addresses_pkey` | UNIQUE (id) |
| `addresses` | `addresses_user_id_is_default_idx` | (user_id, is_default) |
| `admin_invitations` | `admin_invitations_normalized_email_status_idx` | (normalized_email, status) |
| `admin_invitations` | `admin_invitations_one_pending_per_email` | UNIQUE (normalized_email) WHERE (status = 'PENDING'::"InvitationStatus") |
| `admin_invitations` | `admin_invitations_pkey` | UNIQUE (id) |
| `admin_invitations` | `admin_invitations_status_expires_at_idx` | (status, expires_at) |
| `admin_invitations` | `admin_invitations_token_hash_key` | UNIQUE (token_hash) |
| `attempt_question_states` | `attempt_question_states_attempt_id_marked_for_review_idx` | (attempt_id, marked_for_review) |
| `attempt_question_states` | `attempt_question_states_attempt_id_test_version_question_id_key` | UNIQUE (attempt_id, test_version_question_id) |
| `attempt_question_states` | `attempt_question_states_pkey` | UNIQUE (id) |
| `attempt_results` | `attempt_results_attempt_id_key` | UNIQUE (attempt_id) |
| `attempt_results` | `attempt_results_pkey` | UNIQUE (id) |
| `attempt_section_states` | `attempt_section_states_attempt_id_section_id_key` | UNIQUE (attempt_id, section_id) |
| `attempt_section_states` | `attempt_section_states_one_active_per_attempt` | UNIQUE (attempt_id) WHERE (active_since IS NOT NULL) |
| `attempt_section_states` | `attempt_section_states_pkey` | UNIQUE (id) |
| `audit_logs` | `audit_logs_action_created_at_idx` | (action, created_at) |
| `audit_logs` | `audit_logs_actor_user_id_created_at_idx` | (actor_user_id, created_at) |
| `audit_logs` | `audit_logs_pkey` | UNIQUE (id) |
| `audit_logs` | `audit_logs_target_type_target_id_created_at_idx` | (target_type, target_id, created_at) |
| `auth_events` | `auth_events_email_hash_created_at_idx` | (email_hash, created_at) |
| `auth_events` | `auth_events_pkey` | UNIQUE (id) |
| `auth_events` | `auth_events_type_created_at_idx` | (type, created_at) |
| `auth_events` | `auth_events_user_id_created_at_idx` | (user_id, created_at) |
| `auth_tokens` | `auth_tokens_pkey` | UNIQUE (id) |
| `auth_tokens` | `auth_tokens_token_hash_key` | UNIQUE (token_hash) |
| `auth_tokens` | `auth_tokens_user_id_purpose_expires_at_idx` | (user_id, purpose, expires_at) |
| `cancellation_requests` | `cancellation_requests_order_id_requested_at_idx` | (order_id, requested_at) |
| `cancellation_requests` | `cancellation_requests_pkey` | UNIQUE (id) |
| `cancellation_requests` | `cancellation_requests_status_requested_at_idx` | (status, requested_at) |
| `cart_items` | `cart_items_cart_id_product_id_key` | UNIQUE (cart_id, product_id) |
| `cart_items` | `cart_items_pkey` | UNIQUE (id) |
| `carts` | `carts_one_active_per_guest` | UNIQUE (guest_token_hash) WHERE ((status = 'ACTIVE'::"CartStatus") AND (guest_token_hash IS NOT NULL)) |
| `carts` | `carts_one_active_per_user` | UNIQUE (user_id) WHERE ((status = 'ACTIVE'::"CartStatus") AND (user_id IS NOT NULL)) |
| `carts` | `carts_pkey` | UNIQUE (id) |
| `carts` | `carts_status_expires_at_idx` | (status, expires_at) |
| `carts` | `carts_user_id_status_idx` | (user_id, status) |
| `course_exam_categories` | `course_exam_categories_pkey` | UNIQUE (course_id, exam_category_id) |
| `course_modules` | `course_modules_course_id_idx` | (course_id) |
| `course_modules` | `course_modules_course_id_sort_order_key` | UNIQUE (course_id, sort_order) |
| `course_modules` | `course_modules_pkey` | UNIQUE (id) |
| `course_subjects` | `course_subjects_pkey` | UNIQUE (course_id, subject_id) |
| `courses` | `courses_pkey` | UNIQUE (id) |
| `courses` | `courses_preview_lesson_id_key` | UNIQUE (preview_lesson_id) |
| `courses` | `courses_slug_key` | UNIQUE (slug) |
| `courses` | `courses_status_published_at_idx` | (status, published_at) |
| `decision_corrections` | `decision_corrections_corrected_by_id_created_at_idx` | (corrected_by_id, created_at) |
| `decision_corrections` | `decision_corrections_payment_submission_id_key` | UNIQUE (payment_submission_id) |
| `decision_corrections` | `decision_corrections_pkey` | UNIQUE (id) |
| `decision_corrections` | `decision_corrections_subscription_period_id_key` | UNIQUE (subscription_period_id) |
| `decision_corrections` | `decision_corrections_subscription_request_id_key` | UNIQUE (subscription_request_id) |
| `exam_categories` | `exam_categories_pkey` | UNIQUE (id) |
| `exam_categories` | `exam_categories_slug_key` | UNIQUE (slug) |
| `hls_packages` | `hls_packages_pkey` | UNIQUE (id) |
| `hls_packages` | `hls_packages_status_created_at_idx` | (status, created_at) |
| `hls_packages` | `hls_packages_video_asset_id_profile_version_key` | UNIQUE (video_asset_id, profile_version) |
| `idempotency_records` | `idempotency_records_expires_at_idx` | (expires_at) |
| `idempotency_records` | `idempotency_records_operation_actor_key_idempotency_key_key` | UNIQUE (operation, actor_key, idempotency_key) |
| `idempotency_records` | `idempotency_records_pkey` | UNIQUE (id) |
| `inventory_balances` | `inventory_balances_pkey` | UNIQUE (id) |
| `inventory_balances` | `inventory_balances_product_id_key` | UNIQUE (product_id) |
| `inventory_movements` | `inventory_movements_actor_user_id_created_at_idx` | (actor_user_id, created_at) |
| `inventory_movements` | `inventory_movements_pkey` | UNIQUE (id) |
| `inventory_movements` | `inventory_movements_product_id_created_at_idx` | (product_id, created_at) |
| `lesson_progress` | `lesson_progress_pkey` | UNIQUE (id) |
| `lesson_progress` | `lesson_progress_user_id_last_watched_at_idx` | (user_id, last_watched_at) |
| `lesson_progress` | `lesson_progress_user_id_lesson_id_key` | UNIQUE (user_id, lesson_id) |
| `lesson_resources` | `lesson_resources_lesson_id_is_published_sort_order_idx` | (lesson_id, is_published, sort_order) |
| `lesson_resources` | `lesson_resources_pkey` | UNIQUE (id) |
| `lessons` | `lessons_active_video_asset_id_key` | UNIQUE (active_video_asset_id) |
| `lessons` | `lessons_module_id_sort_order_key` | UNIQUE (module_id, sort_order) |
| `lessons` | `lessons_module_id_status_idx` | (module_id, status) |
| `lessons` | `lessons_pkey` | UNIQUE (id) |
| `notifications` | `notifications_pkey` | UNIQUE (id) |
| `notifications` | `notifications_user_id_status_created_at_idx` | (user_id, status, created_at) |
| `oauth_accounts` | `oauth_accounts_pkey` | UNIQUE (id) |
| `oauth_accounts` | `oauth_accounts_provider_provider_subject_key` | UNIQUE (provider, provider_subject) |
| `oauth_accounts` | `oauth_accounts_user_id_idx` | (user_id) |
| `order_events` | `order_events_order_id_created_at_idx` | (order_id, created_at) |
| `order_events` | `order_events_pkey` | UNIQUE (id) |
| `order_items` | `order_items_pkey` | UNIQUE (id) |
| `order_items` | `order_items_product_id_idx` | (product_id) |
| `orders` | `orders_order_number_key` | UNIQUE (order_number) |
| `orders` | `orders_pkey` | UNIQUE (id) |
| `orders` | `orders_status_created_at_idx` | (status, created_at) |
| `orders` | `orders_user_id_created_at_idx` | (user_id, created_at) |
| `outbox_events` | `outbox_events_aggregate_type_aggregate_id_idx` | (aggregate_type, aggregate_id) |
| `outbox_events` | `outbox_events_pkey` | UNIQUE (id) |
| `outbox_events` | `outbox_events_status_available_at_idx` | (status, available_at) |
| `payment_submissions` | `payment_submissions_order_id_submitted_at_idx` | (order_id, submitted_at) |
| `payment_submissions` | `payment_submissions_pkey` | UNIQUE (id) |
| `payment_submissions` | `payment_submissions_status_submitted_at_idx` | (status, submitted_at) |
| `permissions` | `permissions_key_key` | UNIQUE (key) |
| `permissions` | `permissions_pkey` | UNIQUE (id) |
| `playback_sessions` | `playback_sessions_grant_id_hash_key` | UNIQUE (grant_id_hash) |
| `playback_sessions` | `playback_sessions_lesson_id_created_at_idx` | (lesson_id, created_at) |
| `playback_sessions` | `playback_sessions_pkey` | UNIQUE (id) |
| `playback_sessions` | `playback_sessions_user_id_expires_at_idx` | (user_id, expires_at) |
| `playback_sessions` | `playback_sessions_video_asset_id_expires_at_idx` | (video_asset_id, expires_at) |
| `product_images` | `product_images_one_primary_per_product` | UNIQUE (product_id) WHERE (is_primary = true) |
| `product_images` | `product_images_pkey` | UNIQUE (id) |
| `product_images` | `product_images_product_id_is_primary_idx` | (product_id, is_primary) |
| `product_images` | `product_images_product_id_sort_order_key` | UNIQUE (product_id, sort_order) |
| `products` | `products_author_idx` | (author) |
| `products` | `products_isbn_idx` | (isbn) |
| `products` | `products_pkey` | UNIQUE (id) |
| `products` | `products_publisher_idx` | (publisher) |
| `products` | `products_sku_key` | UNIQUE (sku) |
| `products` | `products_slug_key` | UNIQUE (slug) |
| `products` | `products_status_published_at_idx` | (status, published_at) |
| `products` | `products_title_idx` | (title) |
| `question_bank_items` | `question_bank_items_pkey` | UNIQUE (id) |
| `question_bank_items` | `question_bank_items_type_is_archived_idx` | (type, is_archived) |
| `question_bank_options` | `question_bank_options_pkey` | UNIQUE (id) |
| `question_bank_options` | `question_bank_options_question_id_idx` | (question_id) |
| `question_bank_options` | `question_bank_options_question_id_sort_order_key` | UNIQUE (question_id, sort_order) |
| `refund_records` | `refund_records_order_id_status_idx` | (order_id, status) |
| `refund_records` | `refund_records_pkey` | UNIQUE (id) |
| `result_release_events` | `result_release_events_pkey` | UNIQUE (id) |
| `result_release_events` | `result_release_events_test_version_id_created_at_idx` | (test_version_id, created_at) |
| `return_requests` | `return_requests_order_id_requested_at_idx` | (order_id, requested_at) |
| `return_requests` | `return_requests_pkey` | UNIQUE (id) |
| `return_requests` | `return_requests_status_requested_at_idx` | (status, requested_at) |
| `role_permissions` | `role_permissions_permission_id_idx` | (permission_id) |
| `role_permissions` | `role_permissions_pkey` | UNIQUE (role_id, permission_id) |
| `roles` | `roles_key_key` | UNIQUE (key) |
| `roles` | `roles_pkey` | UNIQUE (id) |
| `shipments` | `shipments_order_id_status_idx` | (order_id, status) |
| `shipments` | `shipments_pkey` | UNIQUE (id) |
| `shipments` | `shipments_tracking_number_idx` | (tracking_number) |
| `stock_reservations` | `stock_reservations_order_id_product_id_key` | UNIQUE (order_id, product_id) |
| `stock_reservations` | `stock_reservations_pkey` | UNIQUE (id) |
| `stock_reservations` | `stock_reservations_status_expires_at_idx` | (status, expires_at) |
| `store_settings` | `store_settings_pkey` | UNIQUE (key) |
| `subjects` | `subjects_pkey` | UNIQUE (id) |
| `subjects` | `subjects_slug_key` | UNIQUE (slug) |
| `subscription_periods` | `subscription_periods_pkey` | UNIQUE (id) |
| `subscription_periods` | `subscription_periods_source_request_id_key` | UNIQUE (source_request_id) |
| `subscription_periods` | `subscription_periods_user_id_status_starts_at_ends_at_idx` | (user_id, status, starts_at, ends_at) |
| `subscription_plans` | `subscription_plans_is_active_sort_order_idx` | (is_active, sort_order) |
| `subscription_plans` | `subscription_plans_pkey` | UNIQUE (id) |
| `subscription_request_events` | `subscription_request_events_actor_user_id_created_at_idx` | (actor_user_id, created_at) |
| `subscription_request_events` | `subscription_request_events_pkey` | UNIQUE (id) |
| `subscription_request_events` | `subscription_request_events_request_id_created_at_idx` | (request_id, created_at) |
| `subscription_requests` | `subscription_requests_one_pending_per_user` | UNIQUE (user_id) WHERE (status = 'PENDING'::"SubscriptionRequestStatus") |
| `subscription_requests` | `subscription_requests_pkey` | UNIQUE (id) |
| `subscription_requests` | `subscription_requests_status_submitted_at_idx` | (status, submitted_at) |
| `subscription_requests` | `subscription_requests_user_id_status_submitted_at_idx` | (user_id, status, submitted_at) |
| `test_attempts` | `test_attempts_guest_token_hash_test_id_attempt_number_key` | UNIQUE (guest_token_hash, test_id, attempt_number) |
| `test_attempts` | `test_attempts_guest_token_hash_test_id_started_at_idx` | (guest_token_hash, test_id, started_at) |
| `test_attempts` | `test_attempts_one_in_progress_per_guest` | UNIQUE (guest_token_hash, test_id) WHERE ((status = 'IN_PROGRESS'::"AttemptStatus") AND (guest_token_hash IS NOT NULL)) |
| `test_attempts` | `test_attempts_one_in_progress_per_user` | UNIQUE (user_id, test_id) WHERE ((status = 'IN_PROGRESS'::"AttemptStatus") AND (user_id IS NOT NULL)) |
| `test_attempts` | `test_attempts_pkey` | UNIQUE (id) |
| `test_attempts` | `test_attempts_status_expires_at_idx` | (status, expires_at) |
| `test_attempts` | `test_attempts_test_version_id_status_idx` | (test_version_id, status) |
| `test_attempts` | `test_attempts_user_id_test_id_attempt_number_key` | UNIQUE (user_id, test_id, attempt_number) |
| `test_attempts` | `test_attempts_user_id_test_id_started_at_idx` | (user_id, test_id, started_at) |
| `test_courses` | `test_courses_pkey` | UNIQUE (test_id, course_id) |
| `test_exam_categories` | `test_exam_categories_pkey` | UNIQUE (test_id, exam_category_id) |
| `test_subjects` | `test_subjects_pkey` | UNIQUE (test_id, subject_id) |
| `test_version_questions` | `test_version_questions_pkey` | UNIQUE (id) |
| `test_version_questions` | `test_version_questions_section_id_question_order_idx` | (section_id, question_order) |
| `test_version_questions` | `test_version_questions_source_question_id_idx` | (source_question_id) |
| `test_version_questions` | `test_version_questions_test_version_id_question_order_key` | UNIQUE (test_version_id, question_order) |
| `test_version_sections` | `test_version_sections_id_test_version_id_key` | UNIQUE (id, test_version_id) |
| `test_version_sections` | `test_version_sections_pkey` | UNIQUE (id) |
| `test_version_sections` | `test_version_sections_test_version_id_sort_order_key` | UNIQUE (test_version_id, sort_order) |
| `test_versions` | `test_versions_pkey` | UNIQUE (id) |
| `test_versions` | `test_versions_test_id_status_idx` | (test_id, status) |
| `test_versions` | `test_versions_test_id_version_number_key` | UNIQUE (test_id, version_number) |
| `tests` | `tests_active_version_id_key` | UNIQUE (active_version_id) |
| `tests` | `tests_pkey` | UNIQUE (id) |
| `tests` | `tests_single_free_demo` | UNIQUE (is_free_demo) WHERE (is_free_demo = true) |
| `tests` | `tests_slug_key` | UNIQUE (slug) |
| `tests` | `tests_status_created_at_idx` | (status, created_at) |
| `user_credentials` | `user_credentials_pkey` | UNIQUE (id) |
| `user_credentials` | `user_credentials_user_id_key` | UNIQUE (user_id) |
| `user_permissions` | `user_permissions_permission_id_effect_idx` | (permission_id, effect) |
| `user_permissions` | `user_permissions_pkey` | UNIQUE (user_id, permission_id) |
| `user_roles` | `user_roles_pkey` | UNIQUE (user_id, role_id) |
| `user_roles` | `user_roles_role_id_idx` | (role_id) |
| `user_sessions` | `user_sessions_pkey` | UNIQUE (id) |
| `user_sessions` | `user_sessions_revoked_at_expires_at_idx` | (revoked_at, expires_at) |
| `user_sessions` | `user_sessions_session_id_key` | UNIQUE (session_id) |
| `user_sessions` | `user_sessions_user_id_expires_at_idx` | (user_id, expires_at) |
| `users` | `users_normalized_email_key` | UNIQUE (normalized_email) |
| `users` | `users_pkey` | UNIQUE (id) |
| `users` | `users_status_created_at_idx` | (status, created_at) |
| `video_assets` | `video_assets_archive_object_key_key` | UNIQUE (archive_object_key) |
| `video_assets` | `video_assets_intake_object_key_key` | UNIQUE (intake_object_key) |
| `video_assets` | `video_assets_lesson_id_status_idx` | (lesson_id, status) |
| `video_assets` | `video_assets_lesson_id_version_number_key` | UNIQUE (lesson_id, version_number) |
| `video_assets` | `video_assets_pkey` | UNIQUE (id) |
| `video_assets` | `video_assets_status_created_at_idx` | (status, created_at) |
| `video_processing_attempts` | `video_processing_attempts_job_id_attempt_number_key` | UNIQUE (job_id, attempt_number) |
| `video_processing_attempts` | `video_processing_attempts_outcome_started_at_idx` | (outcome, started_at) |
| `video_processing_attempts` | `video_processing_attempts_pkey` | UNIQUE (id) |
| `video_processing_jobs` | `video_processing_jobs_idempotency_key_key` | UNIQUE (idempotency_key) |
| `video_processing_jobs` | `video_processing_jobs_pkey` | UNIQUE (id) |
| `video_processing_jobs` | `video_processing_jobs_status_available_at_idx` | (status, available_at) |
| `video_processing_jobs` | `video_processing_jobs_status_lease_expires_at_idx` | (status, lease_expires_at) |
| `video_processing_jobs` | `video_processing_jobs_video_asset_id_created_at_idx` | (video_asset_id, created_at) |
| `video_renditions` | `video_renditions_hls_package_id_name_key` | UNIQUE (hls_package_id, name) |
| `video_renditions` | `video_renditions_pkey` | UNIQUE (id) |
| `video_renditions` | `video_renditions_playlist_key_key` | UNIQUE (playlist_key) |
| `video_upload_parts` | `video_upload_parts_pkey` | UNIQUE (id) |
| `video_upload_parts` | `video_upload_parts_upload_session_id_part_number_key` | UNIQUE (upload_session_id, part_number) |
| `video_upload_sessions` | `video_upload_sessions_object_key_key` | UNIQUE (object_key) |
| `video_upload_sessions` | `video_upload_sessions_pkey` | UNIQUE (id) |
| `video_upload_sessions` | `video_upload_sessions_provider_upload_id_key` | UNIQUE (provider_upload_id) |
| `video_upload_sessions` | `video_upload_sessions_status_expires_at_idx` | (status, expires_at) |

### CHECK constraints

| Table | Constraint | Definition |
|---|---|---|
| `addresses` | `addresses_country_code_check` | CHECK ((char_length(country_code) = 2)) |
| `attempt_section_states` | `attempt_section_states_valid_state_check` | CHECK (((elapsed_ms >= 0) AND (NOT ((locked_at IS NOT NULL) AND (active_since IS NOT NULL))))) |
| `auth_events` | `auth_events_failure_reason_check` | CHECK (((type <> 'LOGIN_FAILED'::"AuthEventType") OR (failure_reason IS NOT NULL))) |
| `cart_items` | `cart_items_quantity_positive_check` | CHECK ((quantity > 0)) |
| `carts` | `carts_exactly_one_owner_check` | CHECK ((num_nonnulls(user_id, guest_token_hash) = 1)) |
| `carts` | `carts_merge_target_check` | CHECK ((((status = 'MERGED'::"CartStatus") = (merged_into_cart_id IS NOT NULL)) AND ((merged_into_cart_id IS NULL) OR (merged_into_cart_id <> id)))) |
| `decision_corrections` | `decision_corrections_access_effect_check` | CHECK ((((access_effect = 'NONE'::"CorrectionAccessEffect") = (subscription_period_id IS NULL)) AND CASE kind WHEN 'SUBSCRIPTION_APPROVAL_REVERSED'::"DecisionCorrectionKind" THEN (access_effect = 'ACCESS_REVOKED'::"CorrectionAccessEffect") WHEN 'SUBSCRIPTION_REJECTION_REVERSED'::"DecisionCorrectionKind" THEN (access_effect = ANY (ARRAY['ACCESS_GRANTED'::"CorrectionAccessEffect", 'NONE'::"CorrectionAccessEffect"])) ELSE (access_effect = 'NONE'::"CorrectionAccessEffect") END)) |
| `decision_corrections` | `decision_corrections_reason_check` | CHECK ((length(btrim(reason)) > 0)) |
| `decision_corrections` | `decision_corrections_target_check` | CHECK ((((kind = ANY (ARRAY['SUBSCRIPTION_APPROVAL_REVERSED'::"DecisionCorrectionKind", 'SUBSCRIPTION_REJECTION_REVERSED'::"DecisionCorrectionKind"])) AND (subscription_request_id IS NOT NULL) AND (payment_submission_id IS NULL)) OR ((kind = ANY (ARRAY['PAYMENT_APPROVAL_REVERSED'::"DecisionCorrectionKind", 'PAYMENT_REJECTION_REVERSED'::"DecisionCorrectionKind"])) AND (payment_submission_id IS NOT NULL) AND (subscription_request_id IS NULL)))) |
| `idempotency_records` | `idempotency_records_completed_check` | CHECK (((status <> 'COMPLETED'::"IdempotencyStatus") OR ((response_status IS NOT NULL) AND (completed_at IS NOT NULL)))) |
| `idempotency_records` | `idempotency_records_response_status_check` | CHECK (((response_status IS NULL) OR ((response_status >= 100) AND (response_status <= 599)))) |
| `idempotency_records` | `idempotency_records_valid_times_check` | CHECK ((expires_at > created_at)) |
| `inventory_balances` | `inventory_balances_valid_quantity_check` | CHECK (((on_hand_quantity >= 0) AND (reserved_quantity >= 0) AND (reserved_quantity <= on_hand_quantity) AND (low_stock_threshold >= 0))) |
| `lesson_progress` | `lesson_progress_valid_values_check` | CHECK (((position_ms >= 0) AND ((duration_ms IS NULL) OR (duration_ms >= 0)) AND ((percent_complete >= (0)::numeric) AND (percent_complete <= (100)::numeric)))) |
| `order_items` | `order_items_valid_quantities_and_amounts_check` | CHECK (((quantity > 0) AND (mrp_paise_snapshot >= 0) AND (unit_price_paise >= 0) AND (line_total_paise >= 0) AND (line_total_paise = (unit_price_paise * quantity)))) |
| `orders` | `orders_nonnegative_amounts_check` | CHECK (((item_subtotal_paise >= 0) AND (shipping_paise >= 0) AND (discount_paise >= 0) AND (total_paise >= 0))) |
| `orders` | `orders_total_check` | CHECK ((total_paise = ((item_subtotal_paise + shipping_paise) - discount_paise))) |
| `payment_submissions` | `payment_submissions_amount_nonnegative_check` | CHECK ((amount_paise >= 0)) |
| `payment_submissions` | `payment_submissions_decision_check` | CHECK (((status <> ALL (ARRAY['APPROVED'::"PaymentSubmissionStatus", 'REJECTED'::"PaymentSubmissionStatus"])) OR ((reviewed_by_id IS NOT NULL) AND (reviewed_at IS NOT NULL)))) |
| `payment_submissions` | `payment_submissions_rejection_reason_check` | CHECK (((status <> 'REJECTED'::"PaymentSubmissionStatus") OR (rejection_reason IS NOT NULL))) |
| `products` | `products_valid_price_check` | CHECK (((mrp_paise >= 0) AND (selling_price_paise >= 0) AND (selling_price_paise <= mrp_paise))) |
| `refund_records` | `refund_records_amount_nonnegative_check` | CHECK ((amount_paise >= 0)) |
| `stock_reservations` | `stock_reservations_valid_quantity_check` | CHECK ((quantity > 0)) |
| `subscription_periods` | `subscription_periods_revocation_check` | CHECK ((((status = 'REVOKED'::"SubscriptionPeriodStatus") AND (revoked_at IS NOT NULL) AND (revocation_reason IS NOT NULL)) OR ((status <> 'REVOKED'::"SubscriptionPeriodStatus") AND (revoked_at IS NULL) AND (revocation_reason IS NULL)))) |
| `subscription_periods` | `subscription_periods_valid_range_check` | CHECK ((ends_at > starts_at)) |
| `subscription_plans` | `subscription_plans_duration_positive_check` | CHECK ((duration_days > 0)) |
| `subscription_plans` | `subscription_plans_price_nonnegative_check` | CHECK ((price_paise >= 0)) |
| `subscription_request_events` | `subscription_request_events_rejection_reason_check` | CHECK (((to_status <> 'REJECTED'::"SubscriptionRequestStatus") OR (reason IS NOT NULL))) |
| `subscription_request_events` | `subscription_request_events_transition_check` | CHECK ((from_status IS DISTINCT FROM to_status)) |
| `subscription_requests` | `subscription_requests_amount_nonnegative_check` | CHECK (((amount_paid_paise >= 0) AND (price_snapshot_paise >= 0))) |
| `subscription_requests` | `subscription_requests_decision_check` | CHECK (((status <> ALL (ARRAY['APPROVED'::"SubscriptionRequestStatus", 'REJECTED'::"SubscriptionRequestStatus"])) OR ((reviewed_by_id IS NOT NULL) AND (reviewed_at IS NOT NULL)))) |
| `subscription_requests` | `subscription_requests_rejection_reason_check` | CHECK (((status <> 'REJECTED'::"SubscriptionRequestStatus") OR (rejection_reason IS NOT NULL))) |
| `test_attempts` | `test_attempts_exactly_one_actor_check` | CHECK ((num_nonnulls(user_id, guest_token_hash) = 1)) |
| `test_attempts` | `test_attempts_valid_time_and_number_check` | CHECK (((attempt_number > 0) AND (expires_at > started_at))) |
| `test_versions` | `test_versions_valid_duration_check` | CHECK (((duration_seconds > 0) AND ((attempt_limit IS NULL) OR (attempt_limit > 0)))) |
| `test_version_sections` | `test_version_sections_subject_snapshot_check` | CHECK (((subject_name_snapshot IS NULL) OR (subject_id IS NOT NULL))) |
| `test_version_sections` | `test_version_sections_valid_values_check` | CHECK (((sort_order >= 0) AND ((duration_seconds IS NULL) OR (duration_seconds > 0)))) |
| `users` | `users_deactivation_check` | CHECK (((status <> 'DEACTIVATED'::"UserStatus") OR (deactivated_at IS NOT NULL))) |
| `video_assets` | `video_assets_valid_dimensions_check` | CHECK ((((width IS NULL) OR (width > 0)) AND ((height IS NULL) OR (height > 0)))) |
| `video_assets` | `video_assets_valid_size_and_version_check` | CHECK (((source_size_bytes > 0) AND (version_number > 0))) |
| `video_processing_jobs` | `video_processing_jobs_progress_check` | CHECK ((((progress_percent >= 0) AND (progress_percent <= 100)) AND (attempts >= 0) AND (max_attempts > 0))) |
| `video_upload_parts` | `video_upload_parts_positive_values_check` | CHECK (((part_number > 0) AND (size_bytes > 0))) |

### Triggers

| Table | Trigger | When | Function |
|---|---|---|---|
| `audit_logs` | `audit_logs_append_only` | BEFORE DELETE OR UPDATE, FOR EACH ROW | `forbid_change()` |
| `audit_logs` | `audit_logs_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `decision_corrections` | `decision_corrections_append_only` | BEFORE DELETE OR UPDATE, FOR EACH ROW | `forbid_change()` |
| `decision_corrections` | `decision_corrections_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `decision_corrections` | `decision_corrections_validate` | BEFORE INSERT, FOR EACH ROW | `validate_decision_correction()` |
| `payment_submissions` | `payment_submissions_decision_is_final` | BEFORE DELETE OR UPDATE, FOR EACH ROW | `guard_final_decision()` |
| `payment_submissions` | `payment_submissions_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `subscription_periods` | `subscription_periods_history_guard` | BEFORE DELETE OR UPDATE, FOR EACH ROW | `guard_subscription_period()` |
| `subscription_periods` | `subscription_periods_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `subscription_periods` | `subscription_periods_revocation_needs_correction` | AFTER UPDATE OF status, FOR EACH ROW, DEFERRABLE INITIALLY DEFERRED, WHEN (((new.status = 'REVOKED'::"SubscriptionPeriodStatus") AND (old.status <> 'REVOKED'::"SubscriptionPeriodStatus"))) | `require_correction_for_revocation()` |
| `subscription_requests` | `subscription_requests_decision_is_final` | BEFORE DELETE OR UPDATE, FOR EACH ROW | `guard_final_decision()` |
| `subscription_requests` | `subscription_requests_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `test_version_questions` | `test_version_questions_frozen_after_publish` | BEFORE INSERT OR DELETE OR UPDATE, FOR EACH ROW | `guard_published_test_version_content()` |
| `test_version_questions` | `test_version_questions_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `test_version_sections` | `test_version_sections_frozen_after_publish` | BEFORE INSERT OR DELETE OR UPDATE, FOR EACH ROW | `guard_published_test_version_content()` |
| `test_version_sections` | `test_version_sections_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `test_versions` | `test_versions_immutable_after_publish` | BEFORE DELETE OR UPDATE, FOR EACH ROW | `guard_published_test_version()` |
| `test_versions` | `test_versions_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `test_versions` | `test_versions_snapshot_subjects_on_publish` | BEFORE UPDATE OF status, FOR EACH ROW, WHEN (((old.status = 'DRAFT'::"TestVersionStatus") AND (new.status <> 'DRAFT'::"TestVersionStatus"))) | `snapshot_section_subjects_on_publish()` |

### Functions

`forbid_change()`, `forbid_truncate()`, `guard_final_decision()`, `guard_published_test_version()`, `guard_published_test_version_content()`, `guard_subscription_period()`, `require_correction_for_revocation()`, `snapshot_section_subjects_on_publish()`, `validate_decision_correction()`

### Runtime role privileges

Every table is owned by `studyverse_migrator`. `studyverse_app` holds `SELECT, INSERT, UPDATE, DELETE` on every table except:

| Table | Owner | `studyverse_app` privileges |
|---|---|---|
| `_prisma_migrations` | studyverse_migrator | none |
| `audit_logs` | studyverse_migrator | SELECT, INSERT |
| `decision_corrections` | studyverse_migrator | SELECT, INSERT |
| `payment_submissions` | studyverse_migrator | SELECT, INSERT, UPDATE |
| `subscription_periods` | studyverse_migrator | SELECT, INSERT, UPDATE |
| `subscription_requests` | studyverse_migrator | SELECT, INSERT, UPDATE |

<!-- generated:inventory:end -->
