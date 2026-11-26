# StudyVerse — Initial Migration Review

**Migration:** `prisma/migrations/20261125070533_init/migration.sql`
**Status:** generated and tested; **not applied** to any persistent or production database. Awaiting approval.
**Branch:** `feature/backend-foundation`
**Prepared:** 25 November 2026

This document supports the approval of the initial database migration. It explains the hand-written database rules, summarises the deletion policy, records how the migration was tested, and lists what is still unverified. The full inventory of database objects at the end is generated from PostgreSQL's catalog, not written by hand.

## 1. Files

| File | What it is |
|---|---|
| `prisma/migrations/20261125070533_init/migration.sql` | The complete migration (2,257 lines). Part 1: Prisma's generated DDL. Part 2: `extra-constraints.sql`, verbatim. Wrapped in `BEGIN;` … `COMMIT;` |
| `prisma/migrations/migration_lock.toml` | Prisma's provider lock (`postgresql`) |
| `prisma/extra-constraints.sql` | The hand-written rules, the source of Part 2. A unit test fails if the two copies differ |
| `prisma/schema.prisma` | The Prisma schema the migration was generated from |

**How it was produced:** Prisma 7.10.1 under Node 22.23.5, using `prisma migrate dev --create-only --name init` against an empty development and shadow database. That output is byte-identical to `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`, except that command's `CREATE SCHEMA IF NOT EXISTS "public"` preamble. So Part 1 is reproducible from the committed schema with no database. Part 2 was appended verbatim.

**Why `BEGIN`/`COMMIT`:** Prisma 7.10.1 doesn't make migrations transactional on PostgreSQL. On 18.7, a migration that failed part-way left its earlier statements applied and was recorded as failed. With the explicit transaction, a failure leaves the database untouched. Recovery is `prisma migrate resolve --rolled-back 20261125070533_init`, then deploying the fixed migration.

## 2. Hand-written rules (Part 2)

### Triggers (4 functions, 10 triggers)

| Function | Triggers | Rule |
|---|---|---|
| `guard_published_test_version()` | `test_versions_immutable_after_publish` (BEFORE UPDATE OR DELETE, per row) | Once a version is `PUBLISHED` or `SUPERSEDED`, only the move `PUBLISHED → SUPERSEDED`, `answer_review_release_at` (release or withhold solutions) and `updated_at` may change. It can't be deleted. Any other column change, including moving it to another test or back to `DRAFT`, is refused |
| `guard_published_test_version_content()` | `test_version_sections_frozen_after_publish`, `test_version_questions_frozen_after_publish` (BEFORE INSERT OR UPDATE OR DELETE, per row) | Sections and questions can only be added, changed or removed while their version is a `DRAFT`. This covers section order, subject, title, instructions and timers, and question assignment, order, prompts, answer keys and marking. When the parent row is already gone, the change is a cascade from deleting a draft version, which is allowed |
| `guard_final_decision(open_status)` | `payment_submissions_decision_is_final` (`'SUBMITTED'`), `subscription_requests_decision_is_final` (`'PENDING'`) (BEFORE UPDATE OR DELETE, per row) | Once a row leaves its open status it is write-once: nothing but `updated_at` may change. No row can ever be deleted (payment and access evidence) |
| `forbid_truncate()` | `*_no_truncate` on `test_versions`, `test_version_sections`, `test_version_questions`, `payment_submissions`, `subscription_requests` (BEFORE TRUNCATE, per statement) | Row triggers don't fire on `TRUNCATE`; these refuse it, including when reached through `TRUNCATE … CASCADE`. The app role has no TRUNCATE right at all; this also stops the owner role |

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

### CHECK constraints (37)

| Group | Constraints | Rule |
|---|---|---|
| Identity of the owner | `carts_exactly_one_owner_check`, `test_attempts_exactly_one_actor_check` | A cart and an attempt belong to exactly one of a learner or a guest token |
| Cart merge | `carts_merge_target_check` | `MERGED` exactly when `merged_into_cart_id` is set, and never the cart itself |
| Decisions | `subscription_requests_decision_check`, `subscription_requests_rejection_reason_check`, `payment_submissions_decision_check`, `payment_submissions_rejection_reason_check` | An approved or rejected row names the reviewer and time (§7.4); a rejection has a reason |
| Request history | `subscription_request_events_transition_check`, `subscription_request_events_rejection_reason_check` | An event changes the status; a rejection event has a reason |
| Accounts | `users_deactivation_check` | A `DEACTIVATED` account has `deactivated_at` |
| Section timers | `attempt_section_states_valid_state_check` | Time used is never negative; a locked section is never active |
| Security and idempotency | `auth_events_failure_reason_check`, `idempotency_records_completed_check`, `idempotency_records_response_status_check`, `idempotency_records_valid_times_check` | Failed sign-ins have a reason code; completed idempotent requests store a response status (100–599) and completion time; expiry follows creation |
| Money | `subscription_plans_price_nonnegative_check`, `subscription_requests_amount_nonnegative_check`, `products_valid_price_check`, `orders_nonnegative_amounts_check`, `orders_total_check`, `order_items_valid_quantities_and_amounts_check`, `payment_submissions_amount_nonnegative_check`, `refund_records_amount_nonnegative_check` | Non-negative paise; selling price ≤ MRP; order total = subtotal + shipping − discount; line total = unit price × quantity |
| Stock and carts | `inventory_balances_valid_quantity_check`, `stock_reservations_valid_quantity_check`, `cart_items_quantity_positive_check` | Non-negative stock, reserved ≤ on hand, positive quantities |
| Time and sizes | `subscription_plans_duration_positive_check`, `subscription_periods_valid_range_check`, `test_versions_valid_duration_check`, `test_version_sections_valid_values_check`, `test_attempts_valid_time_and_number_check`, `lesson_progress_valid_values_check`, `video_assets_valid_size_and_version_check`, `video_assets_valid_dimensions_check`, `video_processing_jobs_progress_check`, `video_upload_parts_positive_values_check`, `addresses_country_code_check` | Positive durations, sizes, versions and part numbers; valid ranges and percentages; two-letter country code |

### Other notable rules (in Part 1, from the schema)

- **Composite foreign key** `test_version_questions(section_id, test_version_id) → test_version_sections(id, test_version_id)`, `ON DELETE NO ACTION`: a question's section must belong to its own version. A section that still has questions can't be deleted; deleting a draft version cascades to both.
- **Unique keys:** `(user_id, test_id, attempt_number)` and `(guest_token_hash, test_id, attempt_number)` number attempts per actor and test. `(order_id, product_id)` gives one reservation per order and product. `(cart_id, product_id)` gives one cart line per book, which the merge upserts into.

## 3. Foreign-key deletion policy

Accounts are deactivated, never hard-deleted by the application. Foreign keys make an accidental hard delete fail instead of erasing history.

| Area | Delete behaviour |
|---|---|
| **Financial** | `orders.user_id`, `payment_submissions.order_id` and `.reviewed_by_id`, `refund_records.order_id` and `.recorded_by_id`, `stock_reservations`, `inventory_movements.product_id` and `.actor_user_id`, `order_items.product_id`: **RESTRICT**. Payment submissions and decided requests also can't be deleted at all (trigger) |
| **Access control and subscriptions** | `subscription_requests.user_id` and `.reviewed_by_id`, `subscription_periods.user_id` and `.activated_by_id`, `user_roles.assigned_by`, `user_permissions.granted_by_id`, `admin_invitations.invited_by_id`: **RESTRICT**. A learner's own `user_roles`/`user_permissions` rows **CASCADE** (current assignments, not history) |
| **Audit and history** | `audit_logs.actor_user_id`, `order_events.actor_user_id`, `subscription_request_events.actor_user_id`, `result_release_events.actor_user_id`, `cancellation_requests`/`return_requests` requester and reviewer, `test_attempts.user_id`: **RESTRICT** |
| **Account-owned data** | credentials, OAuth links, auth tokens, user sessions, addresses, carts, notifications, lesson progress: **CASCADE** |
| **Incidental metadata** (17 SET NULL in total) | course/video authorship, invitation acceptor, last settings editor, playback-session user, learner on auth events, plus non-user links: course preview lesson, active video asset, last-watched asset, order address (the order keeps `address_snapshot`), product category/subject, refund→return request, period→source request, question→bank source (refused anyway once published), test→active version |

Totals: 51 RESTRICT, 38 CASCADE, 17 SET NULL, 1 NO ACTION.

## 4. Behaviour verified, by area

All on **PostgreSQL 18.7**, in `apps/api/test/schema/*.int-spec.ts`. These run in CI's `api` job, against a database migrated from scratch by `prisma migrate deploy`, as the app role.

| Area | What is tested |
|---|---|
| **Published test versions** | 20 kinds of change refused on a published version (sections, order, subjects, timers, question assignment, answer keys, marking, timing, release mode, attempt limit, moving, reopening, deleting); cascades from tests, subjects and the question bank refused; TRUNCATE refused for the owner role; bank edits leave the snapshot unchanged; releasing solutions and superseding work; drafts fully editable |
| **Sections and section timers** | Ordered, subject-linked, individually timed sections with assigned questions; cross-version assignment refused; time used, locking, one active section, no locked-and-active section |
| **Guest demo attempts and retakes** | Retakes numbered per guest and test; numbers can't repeat; guests are independent; guest attempts can be claimed and renumbered after a learner's own |
| **One active attempt** | One `IN_PROGRESS` attempt per learner and per guest per test; a retake after submission is allowed; other tests are independent |
| **Subscription and payment decisions** | Reviewer, time and reason required; decided rows write-once and undeletable; resubmission keeps every decision; reviewer can't be deleted; request event rules; the corrections supported today (manual activation; revoking a period while the approved request stays) |
| **Stock reservations** | Reserved can never exceed on hand, even with an unguarded update; one reservation per order and product; of two concurrent reservations of the last copy exactly one succeeds (two real sessions, the second verified blocked) |
| **Cart merging** | One active cart per guest and learner; history kept; MERGED consistency; larger quantity wins; idempotent on retry; a concurrent double merge waits then does nothing; a failed merge rolls back fully |
| **Audit and actor references** | RESTRICT on actors blocks hard deletes (audit logs, decisions, role grants, attempts, orders, subscriptions); deactivation leaves all history in place |
| **Migration workflow** | One migration applied completely; second deploy is a no-op; `migrate status` up to date; no drift; every custom index, CHECK, trigger and function present; tables owned by the migrator; the app role has exactly row access to every table |

## 5. PostgreSQL 18.7 test commands and results

**Environment.** PostgreSQL **18.7** server binaries from `embedded-postgres@18.7.0-beta.19`, listening on `127.0.0.1`. The npm wrapper is a beta; `postgres --version` reports `PostgreSQL 18.7`. Roles and databases were created by `infra/postgres/init/01-roles-and-databases.sh`. No `psql` binary is available here, so the script ran through a small stand-in that implements the `psql` features it uses (variables, `:'name'` quoting, one statement at a time, stop on error). The runtime was Node **22.23.5**: the official build, SHA-256 verified, used through `PATH` without changing the machine's default Node. Docker's engine is unresponsive on this machine, so the official `postgres:18.7-trixie` image did not run (section 6).

Migration workflow, from `apps/api`, with `DATABASE_MIGRATION_URL` pointing at `studyverse` as `studyverse_migrator`:

| Command | Result |
|---|---|
| `npx prisma migrate dev --create-only --name init` | Created `20261125070533_init` without applying it |
| `npx prisma migrate diff --from-empty --to-schema ../../prisma/schema.prisma --script` | Same DDL as the generated migration (only the `CREATE SCHEMA` preamble differs) |
| `npx prisma migrate deploy` | `All migrations have been successfully applied.` |
| `npx prisma migrate deploy` (again) | `No pending migrations to apply.` |
| `npx prisma migrate status` | `Database schema is up to date!` |
| `npx prisma migrate diff --from-config-datasource --to-schema ../../prisma/schema.prisma --script --exit-code` | Exit 0, `-- This is an empty migration.` (no drift) |
| `npx prisma migrate dev --create-only --name should_not_exist` | Only an empty migration (history replayed in the shadow database matches the schema); deleted |
| Failing migration without / with `BEGIN`…`COMMIT` (scratch) | Without: earlier statements stayed applied. With: nothing applied |

Test suites, from `apps/api`, at commit `b3c1ddf` (Node 22.23.5, npm 10.9.9):

| Command | Result |
|---|---|
| `npm ci` | Exit 0 from a clean `node_modules` (postinstall generates the Prisma client) |
| `npm run test:integration` (`TEST_DATABASE_URL`/`TEST_DATABASE_MIGRATION_URL` → `studyverse_test`) | **107 passed**, 0 failed, 10 files. The global setup emptied the database and ran `prisma migrate deploy` first |
| `npm test` | **77 passed**, 0 failed, 11 files (includes the migration-shape and runtime-version checks) |
| `npm run lint` / `format:check` / `typecheck` / `db:validate` / `build` | All exit 0; lint reports 0 findings |

The frontend is unaffected at the same commit: lint and type-check exit 0, Vitest 488 of 488, Chromium E2E 230 of 230 (production build).

## 6. Not yet verified (blocked)

Docker Desktop's engine on the development machine accepts connections but never answers, so nothing involving a container has run. These are **unverified**:

| Check | How it will be verified |
|---|---|
| The official `postgres:18.7-trixie` image starts with the Compose volume layout (`/var/lib/postgresql`) and runs the init script with real `psql` | CI `api` job (service container plus real `psql`) and CI `container` job; locally `docker compose -f infra/compose.yaml up -d` |
| The migration deploys inside the `migrate` container | CI `container` job |
| The API image builds, starts as `node`, is healthy, contains no env files or credentials, and exits 0 on `docker stop` | CI `container` job; locally `docker compose -f infra/compose.yaml --profile app up -d --build` |
| GitHub Actions passes | Not run yet: the workflows run on a pull request into `develop` |

What did run in place of the container: the Dockerfile's steps replayed outside Docker under Node 22.23.5. The context was filtered like the dockerignore (no env files), followed by `npm ci`, the build, the migrator's `prisma migrate deploy`, and the runtime's production-only install. The resulting runtime layout served live, ready (PostgreSQL 18.7), docs and Problem Details 404s, passed the `HEALTHCHECK` command, and exited 0 on SIGTERM. That checks the Dockerfile's logic, not the image.

## 7. Limitations, deferred decisions and risks

1. **Correcting a wrong approval is undefined (product decision needed).** Corrections of rejections are supported (resubmission, manual activation). For a wrong approval there is no `revoked_by` on subscription periods, no correction record for payments, and `audit_logs` rows can be changed by the app role. A smallest change is proposed in `prisma/README.md` ("Correcting payment and subscription decisions"). If it's approved before this migration is applied, the initial migration will be regenerated to include it.
2. **Rules the database can't enforce** stay in services and must be tested there: preview lesson, active video asset and active test version belonging to their parent; attempt question and section states belonging to the attempt's version; every section of a section-timed version having a duration; the guest-attempt claim and cart-merge procedures (`prisma/README.md`, "Invariants enforced in application services").
3. **Deactivation is enforced by the database only for history.** Refusing sign-in, revoking sessions and invalidating tokens are Milestone 2 requirements (listed in `prisma/README.md`).
4. **Personal-data retention is deferred.** Deactivation isn't deletion; a retention and deletion policy is required before production. Nothing deletes or anonymizes data automatically.
5. **Trigger protections stop the API's role, accidents and application bugs, not a malicious database owner.** The owner role can disable or drop triggers. The app role can't (verified).
6. **Shared reference data isn't snapshotted.** Renaming a subject or a test changes how published sections and tests are labelled; their content and structure don't change. Snapshot the subject name on sections if exam records must show historical names.
7. **The app role can write `_prisma_migrations`.** The init script's default privileges cover every table the migrator creates, including Prisma's bookkeeping table. Low risk. It can be closed by revoking those privileges after the first deploy.
8. **Every future migration must include `BEGIN`/`COMMIT`.** The convention is documented and checked by a test for the initial migration only.
9. **Return requests aren't write-once.** Deleting one would set `refund_records.return_request_id` to NULL. Deferred to the bookstore milestone, where return workflows are designed.
10. **Node 22 reaches end of life on 30 April 2027.** Plan the move to Node 24 before production.
11. **The `app` Compose profile migrates the local `studyverse` database.** Don't run it against data you want to keep until this migration is approved.

## 8. Inventory

<!-- generated:inventory:start (PostgreSQL 18.7; do not edit by hand) -->

Generated from the catalog of a database migrated with `20261125070533_init` on PostgreSQL 18.7.

| Object | Count |
|---|---|
| Tables (plus `_prisma_migrations`) | 68 |
| Enums | 43 |
| Foreign keys | 107 (38 CASCADE, 17 SET NULL, 51 RESTRICT, 1 NO ACTION) |
| Indexes | 206: 68 primary keys, 49 unique, 10 partial unique, 79 non-unique |
| CHECK constraints | 37 |
| Triggers | 10 |

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
| `test_version_sections` | 7 |
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
| `CourseStatus` | DRAFT, PUBLISHED, ARCHIVED |
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
| `course_subjects` | `course_subjects_course_id_fkey` | `courses` (course_id → id) | CASCADE |
| `course_subjects` | `course_subjects_subject_id_fkey` | `subjects` (subject_id → id) | RESTRICT |
| `courses` | `courses_created_by_id_fkey` | `users` (created_by_id → id) | SET NULL |
| `courses` | `courses_preview_lesson_id_fkey` | `lessons` (preview_lesson_id → id) | SET NULL |
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
| `subscription_periods` | `subscription_periods_source_request_id_fkey` | `subscription_requests` (source_request_id → id) | SET NULL |
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
| `test_subjects` | `test_subjects_subject_id_fkey` | `subjects` (subject_id → id) | RESTRICT |
| `test_subjects` | `test_subjects_test_id_fkey` | `tests` (test_id → id) | CASCADE |
| `test_version_questions` | `test_version_questions_section_id_test_version_id_fkey` | `test_version_sections` (section_id, test_version_id → id, test_version_id) | NO ACTION |
| `test_version_questions` | `test_version_questions_source_question_id_fkey` | `question_bank_items` (source_question_id → id) | SET NULL |
| `test_version_questions` | `test_version_questions_test_version_id_fkey` | `test_versions` (test_version_id → id) | CASCADE |
| `test_version_sections` | `test_version_sections_subject_id_fkey` | `subjects` (subject_id → id) | RESTRICT |
| `test_version_sections` | `test_version_sections_test_version_id_fkey` | `test_versions` (test_version_id → id) | CASCADE |
| `test_versions` | `test_versions_test_id_fkey` | `tests` (test_id → id) | RESTRICT |
| `tests` | `tests_active_version_id_fkey` | `test_versions` (active_version_id → id) | SET NULL |
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
| `test_version_sections` | `test_version_sections_valid_values_check` | CHECK (((sort_order >= 0) AND ((duration_seconds IS NULL) OR (duration_seconds > 0)))) |
| `test_versions` | `test_versions_valid_duration_check` | CHECK (((duration_seconds > 0) AND ((attempt_limit IS NULL) OR (attempt_limit > 0)))) |
| `users` | `users_deactivation_check` | CHECK (((status <> 'DEACTIVATED'::"UserStatus") OR (deactivated_at IS NOT NULL))) |
| `video_assets` | `video_assets_valid_dimensions_check` | CHECK ((((width IS NULL) OR (width > 0)) AND ((height IS NULL) OR (height > 0)))) |
| `video_assets` | `video_assets_valid_size_and_version_check` | CHECK (((source_size_bytes > 0) AND (version_number > 0))) |
| `video_processing_jobs` | `video_processing_jobs_progress_check` | CHECK ((((progress_percent >= 0) AND (progress_percent <= 100)) AND (attempts >= 0) AND (max_attempts > 0))) |
| `video_upload_parts` | `video_upload_parts_positive_values_check` | CHECK (((part_number > 0) AND (size_bytes > 0))) |

### Triggers

| Table | Trigger | When | Function |
|---|---|---|---|
| `payment_submissions` | `payment_submissions_decision_is_final` | BEFORE UPDATE OR DELETE, FOR EACH ROW | `guard_final_decision()` |
| `payment_submissions` | `payment_submissions_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `subscription_requests` | `subscription_requests_decision_is_final` | BEFORE UPDATE OR DELETE, FOR EACH ROW | `guard_final_decision()` |
| `subscription_requests` | `subscription_requests_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `test_version_questions` | `test_version_questions_frozen_after_publish` | BEFORE INSERT OR UPDATE OR DELETE, FOR EACH ROW | `guard_published_test_version_content()` |
| `test_version_questions` | `test_version_questions_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `test_version_sections` | `test_version_sections_frozen_after_publish` | BEFORE INSERT OR UPDATE OR DELETE, FOR EACH ROW | `guard_published_test_version_content()` |
| `test_version_sections` | `test_version_sections_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |
| `test_versions` | `test_versions_immutable_after_publish` | BEFORE UPDATE OR DELETE, FOR EACH ROW | `guard_published_test_version()` |
| `test_versions` | `test_versions_no_truncate` | BEFORE TRUNCATE, FOR EACH STATEMENT | `forbid_truncate()` |

<!-- generated:inventory:end -->
