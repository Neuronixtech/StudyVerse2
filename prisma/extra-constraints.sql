-- PostgreSQL rules Prisma Schema Language can't express: partial unique indexes, CHECK
-- constraints and triggers. Reviewed in November 2026 and appended verbatim to the
-- initial migration, prisma/migrations/20261125070533_init/migration.sql; a test checks
-- that the two stay identical. Once that migration is applied, never edit this file:
-- add new or changed rules in a new migration.

-- At most one pending subscription activation request per learner.
CREATE UNIQUE INDEX "subscription_requests_one_pending_per_user"
  ON "subscription_requests" ("user_id")
  WHERE "status" = 'PENDING';

-- At most one designated free demo test in the entire platform.
CREATE UNIQUE INDEX "tests_single_free_demo"
  ON "tests" ("is_free_demo")
  WHERE "is_free_demo" = TRUE;

-- At most one primary image for a product.
CREATE UNIQUE INDEX "product_images_one_primary_per_product"
  ON "product_images" ("product_id")
  WHERE "is_primary" = TRUE;

-- At most one active cart per authenticated learner.
CREATE UNIQUE INDEX "carts_one_active_per_user"
  ON "carts" ("user_id")
  WHERE "status" = 'ACTIVE' AND "user_id" IS NOT NULL;

-- At most one active cart per guest token.
CREATE UNIQUE INDEX "carts_one_active_per_guest"
  ON "carts" ("guest_token_hash")
  WHERE "status" = 'ACTIVE' AND "guest_token_hash" IS NOT NULL;

-- Cart identity must be either a signed-in user or a guest token, never both/neither.
ALTER TABLE "carts"
  ADD CONSTRAINT "carts_exactly_one_owner_check"
  CHECK (num_nonnulls("user_id", "guest_token_hash") = 1);

-- A merged guest cart names the cart it was folded into, and only merged carts do.
ALTER TABLE "carts"
  ADD CONSTRAINT "carts_merge_target_check"
  CHECK (("status" = 'MERGED') = ("merged_into_cart_id" IS NOT NULL)
    AND ("merged_into_cart_id" IS NULL OR "merged_into_cart_id" <> "id"));

-- Anonymous demo attempts may be unregistered; account attempts must have a user.
ALTER TABLE "test_attempts"
  ADD CONSTRAINT "test_attempts_exactly_one_actor_check"
  CHECK (num_nonnulls("user_id", "guest_token_hash") = 1);

-- At most one in-progress attempt per actor per test. Starting a test that already
-- has an in-progress attempt resumes it, so a second tab or a double click can't
-- open a parallel attempt (Backend_architecture.md §9.6, §10.3).
CREATE UNIQUE INDEX "test_attempts_one_in_progress_per_user"
  ON "test_attempts" ("user_id", "test_id")
  WHERE "status" = 'IN_PROGRESS' AND "user_id" IS NOT NULL;

CREATE UNIQUE INDEX "test_attempts_one_in_progress_per_guest"
  ON "test_attempts" ("guest_token_hash", "test_id")
  WHERE "status" = 'IN_PROGRESS' AND "guest_token_hash" IS NOT NULL;

ALTER TABLE "subscription_plans"
  ADD CONSTRAINT "subscription_plans_duration_positive_check"
  CHECK ("duration_days" > 0),
  ADD CONSTRAINT "subscription_plans_price_nonnegative_check"
  CHECK ("price_paise" >= 0);

ALTER TABLE "subscription_requests"
  ADD CONSTRAINT "subscription_requests_amount_nonnegative_check"
  CHECK ("amount_paid_paise" >= 0 AND "price_snapshot_paise" >= 0);

ALTER TABLE "subscription_periods"
  ADD CONSTRAINT "subscription_periods_valid_range_check"
  CHECK ("ends_at" > "starts_at");

ALTER TABLE "video_assets"
  ADD CONSTRAINT "video_assets_valid_size_and_version_check"
  CHECK ("source_size_bytes" > 0 AND "version_number" > 0),
  ADD CONSTRAINT "video_assets_valid_dimensions_check"
  CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0));

ALTER TABLE "video_processing_jobs"
  ADD CONSTRAINT "video_processing_jobs_progress_check"
  CHECK ("progress_percent" BETWEEN 0 AND 100 AND "attempts" >= 0 AND "max_attempts" > 0);

ALTER TABLE "video_upload_parts"
  ADD CONSTRAINT "video_upload_parts_positive_values_check"
  CHECK ("part_number" > 0 AND "size_bytes" > 0);

ALTER TABLE "test_versions"
  ADD CONSTRAINT "test_versions_valid_duration_check"
  CHECK ("duration_seconds" > 0 AND ("attempt_limit" IS NULL OR "attempt_limit" > 0));

ALTER TABLE "test_version_sections"
  ADD CONSTRAINT "test_version_sections_valid_values_check"
  CHECK ("sort_order" >= 0 AND ("duration_seconds" IS NULL OR "duration_seconds" > 0));

ALTER TABLE "test_attempts"
  ADD CONSTRAINT "test_attempts_valid_time_and_number_check"
  CHECK ("attempt_number" > 0 AND "expires_at" > "started_at");

ALTER TABLE "lesson_progress"
  ADD CONSTRAINT "lesson_progress_valid_values_check"
  CHECK ("position_ms" >= 0 AND ("duration_ms" IS NULL OR "duration_ms" >= 0)
    AND "percent_complete" BETWEEN 0 AND 100);

ALTER TABLE "products"
  ADD CONSTRAINT "products_valid_price_check"
  CHECK ("mrp_paise" >= 0 AND "selling_price_paise" >= 0 AND "selling_price_paise" <= "mrp_paise");

ALTER TABLE "inventory_balances"
  ADD CONSTRAINT "inventory_balances_valid_quantity_check"
  CHECK ("on_hand_quantity" >= 0 AND "reserved_quantity" >= 0
    AND "reserved_quantity" <= "on_hand_quantity" AND "low_stock_threshold" >= 0);

ALTER TABLE "stock_reservations"
  ADD CONSTRAINT "stock_reservations_valid_quantity_check"
  CHECK ("quantity" > 0);

ALTER TABLE "addresses"
  ADD CONSTRAINT "addresses_country_code_check"
  CHECK (char_length("country_code") = 2);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_nonnegative_amounts_check"
  CHECK ("item_subtotal_paise" >= 0 AND "shipping_paise" >= 0
    AND "discount_paise" >= 0 AND "total_paise" >= 0),
  ADD CONSTRAINT "orders_total_check"
  CHECK ("total_paise" = "item_subtotal_paise" + "shipping_paise" - "discount_paise");

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_valid_quantities_and_amounts_check"
  CHECK ("quantity" > 0 AND "mrp_paise_snapshot" >= 0
    AND "unit_price_paise" >= 0 AND "line_total_paise" >= 0
    AND "line_total_paise" = "unit_price_paise" * "quantity");

ALTER TABLE "payment_submissions"
  ADD CONSTRAINT "payment_submissions_amount_nonnegative_check"
  CHECK ("amount_paise" >= 0);

ALTER TABLE "refund_records"
  ADD CONSTRAINT "refund_records_amount_nonnegative_check"
  CHECK ("amount_paise" >= 0);

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_positive_check"
  CHECK ("quantity" > 0);

-- At most one pending invitation for a normalized email address.
CREATE UNIQUE INDEX "admin_invitations_one_pending_per_email"
  ON "admin_invitations" ("normalized_email")
  WHERE "status" = 'PENDING';

-- At most one default address per learner.
CREATE UNIQUE INDEX "addresses_one_default_per_user"
  ON "addresses" ("user_id")
  WHERE "is_default" = TRUE;

-- A decided subscription request or payment names the admin and the time, and a
-- rejection says why (Backend_architecture.md §2.2, §7.4: approval needs an admin
-- actor, a timestamp and a decision). The reviewer FKs are ON DELETE RESTRICT so
-- deleting a user can't silently erase who approved access or money.
ALTER TABLE "subscription_requests"
  ADD CONSTRAINT "subscription_requests_decision_check"
  CHECK ("status" NOT IN ('APPROVED', 'REJECTED')
    OR ("reviewed_by_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  ADD CONSTRAINT "subscription_requests_rejection_reason_check"
  CHECK ("status" <> 'REJECTED' OR "rejection_reason" IS NOT NULL);

ALTER TABLE "payment_submissions"
  ADD CONSTRAINT "payment_submissions_decision_check"
  CHECK ("status" NOT IN ('APPROVED', 'REJECTED')
    OR ("reviewed_by_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)),
  ADD CONSTRAINT "payment_submissions_rejection_reason_check"
  CHECK ("status" <> 'REJECTED' OR "rejection_reason" IS NOT NULL);

-- Section timer state: time used is never negative, a locked section can't be the
-- active one, and an attempt has at most one active section at a time.
ALTER TABLE "attempt_section_states"
  ADD CONSTRAINT "attempt_section_states_valid_state_check"
  CHECK ("elapsed_ms" >= 0 AND NOT ("locked_at" IS NOT NULL AND "active_since" IS NOT NULL));

-- A subject-name snapshot only exists for a section that has a subject.
ALTER TABLE "test_version_sections"
  ADD CONSTRAINT "test_version_sections_subject_snapshot_check"
  CHECK ("subject_name_snapshot" IS NULL OR "subject_id" IS NOT NULL);

CREATE UNIQUE INDEX "attempt_section_states_one_active_per_attempt"
  ON "attempt_section_states" ("attempt_id")
  WHERE "active_since" IS NOT NULL;

-- A closed (soft-deleted) account records when it was closed.
ALTER TABLE "users"
  ADD CONSTRAINT "users_deactivation_check"
  CHECK ("status" <> 'DEACTIVATED' OR "deactivated_at" IS NOT NULL);

-- A correction targets exactly the kind of decision it names and gives a reason, and
-- its access effect fits the kind: an approval reversal revokes the period that
-- approval created; a rejection reversal grants a new period or changes nothing;
-- payment corrections never change access (refund and order consequences aren't
-- defined by the product).
ALTER TABLE "decision_corrections"
  ADD CONSTRAINT "decision_corrections_target_check"
  CHECK (
    ("kind" IN ('SUBSCRIPTION_APPROVAL_REVERSED', 'SUBSCRIPTION_REJECTION_REVERSED')
      AND "subscription_request_id" IS NOT NULL AND "payment_submission_id" IS NULL)
    OR ("kind" IN ('PAYMENT_APPROVAL_REVERSED', 'PAYMENT_REJECTION_REVERSED')
      AND "payment_submission_id" IS NOT NULL AND "subscription_request_id" IS NULL)),
  ADD CONSTRAINT "decision_corrections_access_effect_check"
  CHECK (
    ("access_effect" = 'NONE') = ("subscription_period_id" IS NULL)
    AND CASE "kind"
      WHEN 'SUBSCRIPTION_APPROVAL_REVERSED' THEN "access_effect" = 'ACCESS_REVOKED'
      WHEN 'SUBSCRIPTION_REJECTION_REVERSED' THEN "access_effect" IN ('ACCESS_GRANTED', 'NONE')
      ELSE "access_effect" = 'NONE'
    END),
  ADD CONSTRAINT "decision_corrections_reason_check"
  CHECK (length(btrim("reason")) > 0);

-- A REVOKED period records when and why; no other period does.
ALTER TABLE "subscription_periods"
  ADD CONSTRAINT "subscription_periods_revocation_check"
  CHECK (
    ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL AND "revocation_reason" IS NOT NULL)
    OR ("status" <> 'REVOKED' AND "revoked_at" IS NULL AND "revocation_reason" IS NULL));

-- A failed sign-in records a reason code.
ALTER TABLE "auth_events"
  ADD CONSTRAINT "auth_events_failure_reason_check"
  CHECK ("type" <> 'LOGIN_FAILED' OR "failure_reason" IS NOT NULL);

-- A request event is a real status change, and a rejection says why.
ALTER TABLE "subscription_request_events"
  ADD CONSTRAINT "subscription_request_events_transition_check"
  CHECK ("from_status" IS DISTINCT FROM "to_status"),
  ADD CONSTRAINT "subscription_request_events_rejection_reason_check"
  CHECK ("to_status" <> 'REJECTED' OR "reason" IS NOT NULL);

-- A completed idempotent request has a stored outcome; times are coherent.
ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_completed_check"
  CHECK ("status" <> 'COMPLETED' OR ("response_status" IS NOT NULL AND "completed_at" IS NOT NULL)),
  ADD CONSTRAINT "idempotency_records_response_status_check"
  CHECK ("response_status" IS NULL OR "response_status" BETWEEN 100 AND 599),
  ADD CONSTRAINT "idempotency_records_valid_times_check"
  CHECK ("expires_at" > "created_at");

-- -----------------------------------------------------------------------------
-- Triggers: invariants that span rows or state transitions. Prisma doesn't manage
-- functions or triggers, so they live here with the other hand-written SQL.
-- -----------------------------------------------------------------------------

-- Published test versions are immutable (Backend_architecture.md §7.4, §16.4). A
-- DRAFT version is the editable configuration; publishing freezes it, and editing a
-- published test means creating a new DRAFT version. After publication only these
-- may change: status PUBLISHED -> SUPERSEDED, answer_review_release_at (the
-- release control, recorded in result_release_events) and updated_at. A published
-- or superseded version can't be deleted.
CREATE FUNCTION "guard_published_test_version"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  mutable_columns text[] := ARRAY['status', 'answer_review_release_at', 'updated_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'test version % is %, so it cannot be deleted', OLD."id", OLD."status"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" <> 'DRAFT' AND (
       (NEW."status" IS DISTINCT FROM OLD."status"
         AND NOT (OLD."status" = 'PUBLISHED' AND NEW."status" = 'SUPERSEDED'))
       OR (to_jsonb(NEW) - mutable_columns) IS DISTINCT FROM (to_jsonb(OLD) - mutable_columns)
     ) THEN
    RAISE EXCEPTION 'test version % is %, so its configuration cannot change; create a new draft version', OLD."id", OLD."status"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "test_versions_immutable_after_publish"
  BEFORE UPDATE OR DELETE ON "test_versions"
  FOR EACH ROW EXECUTE FUNCTION "guard_published_test_version"();

-- Sections and questions can only be added, changed or removed while their version
-- is a DRAFT. When the parent row no longer exists, the change is the cascade from
-- deleting a draft version, which is allowed.
CREATE FUNCTION "guard_published_test_version_content"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  version_ids uuid[];
  frozen_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    version_ids := ARRAY[NEW."test_version_id"];
  ELSIF TG_OP = 'DELETE' THEN
    version_ids := ARRAY[OLD."test_version_id"];
  ELSE
    version_ids := ARRAY[OLD."test_version_id", NEW."test_version_id"];
  END IF;

  SELECT "id" INTO frozen_id FROM "test_versions"
    WHERE "id" = ANY (version_ids) AND "status" <> 'DRAFT'
    LIMIT 1;
  IF frozen_id IS NOT NULL THEN
    RAISE EXCEPTION '% of test version % cannot change: the version is no longer a draft', TG_TABLE_NAME, frozen_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "test_version_sections_frozen_after_publish"
  BEFORE INSERT OR UPDATE OR DELETE ON "test_version_sections"
  FOR EACH ROW EXECUTE FUNCTION "guard_published_test_version_content"();

CREATE TRIGGER "test_version_questions_frozen_after_publish"
  BEFORE INSERT OR UPDATE OR DELETE ON "test_version_questions"
  FOR EACH ROW EXECUTE FUNCTION "guard_published_test_version_content"();

-- Publication snapshots each section's subject name, so renaming a subject later
-- never relabels a published test (sections are frozen from then on). Runs BEFORE the
-- status change is written, while the version is still a DRAFT, so the section guard
-- above allows these updates. Drafts keep the snapshot NULL and show the current name.
CREATE FUNCTION "snapshot_section_subjects_on_publish"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "test_version_sections" AS s
     SET "subject_name_snapshot" = sub."name"
    FROM "subjects" AS sub
   WHERE s."test_version_id" = NEW."id"
     AND sub."id" = s."subject_id";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "test_versions_snapshot_subjects_on_publish"
  BEFORE UPDATE OF "status" ON "test_versions"
  FOR EACH ROW
  WHEN (OLD."status" = 'DRAFT' AND NEW."status" <> 'DRAFT')
  EXECUTE FUNCTION "snapshot_section_subjects_on_publish"();

-- Payment and subscription decisions are final, and the evidence is never deleted.
-- payment_submissions also holds the admin's decision (the architecture's separate
-- payment_decisions table is folded in). History survives because a resubmission
-- after a rejection is a new row and a decided row is write-once: once its status
-- leaves the open state, nothing but updated_at may change. Rows can't be deleted
-- (Backend_architecture.md §7.4, §14.2). The trigger argument is the open status.
CREATE FUNCTION "guard_final_decision"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  open_status text := TG_ARGV[0];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% % is payment or access evidence and cannot be deleted', TG_TABLE_NAME, OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF OLD."status"::text <> open_status
     AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    RAISE EXCEPTION '% % was decided (%) and cannot change', TG_TABLE_NAME, OLD."id", OLD."status"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "payment_submissions_decision_is_final"
  BEFORE UPDATE OR DELETE ON "payment_submissions"
  FOR EACH ROW EXECUTE FUNCTION "guard_final_decision"('SUBMITTED');

CREATE TRIGGER "subscription_requests_decision_is_final"
  BEFORE UPDATE OR DELETE ON "subscription_requests"
  FOR EACH ROW EXECUTE FUNCTION "guard_final_decision"('PENDING');

-- Row-level triggers don't fire on TRUNCATE, so TRUNCATE (with or without CASCADE)
-- would bypass both guards above. The API's role has no TRUNCATE right; these
-- statement-level guards also stop the owner role. They fire for every table a
-- TRUNCATE ... CASCADE reaches. Clearing data means DELETE (which the row guards check)
-- or dropping a disposable local or test database.
CREATE FUNCTION "forbid_truncate"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% holds protected history and cannot be truncated', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "test_versions_no_truncate"
  BEFORE TRUNCATE ON "test_versions"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_truncate"();

CREATE TRIGGER "test_version_sections_no_truncate"
  BEFORE TRUNCATE ON "test_version_sections"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_truncate"();

CREATE TRIGGER "test_version_questions_no_truncate"
  BEFORE TRUNCATE ON "test_version_questions"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_truncate"();

CREATE TRIGGER "payment_submissions_no_truncate"
  BEFORE TRUNCATE ON "payment_submissions"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_truncate"();

CREATE TRIGGER "subscription_requests_no_truncate"
  BEFORE TRUNCATE ON "subscription_requests"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_truncate"();

-- Audit log entries are append-only (Backend_architecture.md §14.2): the API inserts
-- them, nobody updates or deletes them. This trigger applies to every role, including
-- the owner, unless the owner deliberately disables it (see "Trust boundary" in
-- prisma/README.md).
CREATE FUNCTION "forbid_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: rows cannot be updated or deleted', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "forbid_change"();

CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_truncate"();

-- Decision corrections: checked against the original decision on insert, then
-- append-only. The original decision rows themselves are never modified.
CREATE FUNCTION "validate_decision_correction"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  expected_status text := CASE WHEN NEW."kind"::text LIKE '%APPROVAL_REVERSED'
                               THEN 'APPROVED' ELSE 'REJECTED' END;
  decision_status text;
  learner uuid;
  period "subscription_periods"%ROWTYPE;
BEGIN
  IF NEW."subscription_request_id" IS NOT NULL THEN
    SELECT "status"::text, "user_id" INTO decision_status, learner
      FROM "subscription_requests" WHERE "id" = NEW."subscription_request_id";
  ELSE
    SELECT "status"::text INTO decision_status
      FROM "payment_submissions" WHERE "id" = NEW."payment_submission_id";
  END IF;
  IF decision_status IS DISTINCT FROM expected_status THEN
    RAISE EXCEPTION '% reverses an % decision, but the decision is %',
      NEW."kind", expected_status, coalesce(decision_status, 'missing')
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW."subscription_period_id" IS NOT NULL THEN
    SELECT * INTO period FROM "subscription_periods" WHERE "id" = NEW."subscription_period_id";
    IF period."user_id" IS DISTINCT FROM learner THEN
      RAISE EXCEPTION 'subscription period % belongs to another learner', NEW."subscription_period_id"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW."access_effect" = 'ACCESS_REVOKED'
       AND (period."source_request_id" IS DISTINCT FROM NEW."subscription_request_id"
            OR period."status" <> 'REVOKED') THEN
      RAISE EXCEPTION 'an approval reversal must revoke the period that approval created (period %)',
        NEW."subscription_period_id"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW."access_effect" = 'ACCESS_GRANTED'
       AND (period."source_request_id" IS NOT NULL OR period."status" <> 'ACTIVE'
            OR period."activated_by_id" IS DISTINCT FROM NEW."corrected_by_id") THEN
      RAISE EXCEPTION 'a rejection reversal grants a new active period activated by the correcting admin (period %)',
        NEW."subscription_period_id"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "decision_corrections_validate"
  BEFORE INSERT ON "decision_corrections"
  FOR EACH ROW EXECUTE FUNCTION "validate_decision_correction"();

CREATE TRIGGER "decision_corrections_append_only"
  BEFORE UPDATE OR DELETE ON "decision_corrections"
  FOR EACH ROW EXECUTE FUNCTION "forbid_change"();

CREATE TRIGGER "decision_corrections_no_truncate"
  BEFORE TRUNCATE ON "decision_corrections"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_truncate"();

-- Subscription periods are access history: never deleted, and the granted window,
-- learner, plan, source request and activator never change. The only changes are
-- ACTIVE -> EXPIRED (expiry job) and ACTIVE or EXPIRED -> REVOKED with revoked_at and
-- revocation_reason, after which the revocation itself is fixed.
CREATE FUNCTION "guard_subscription_period"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  changeable text[] := ARRAY['status', 'revoked_at', 'revocation_reason'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'subscription period % is access history and cannot be deleted', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF (to_jsonb(NEW) - changeable) IS DISTINCT FROM (to_jsonb(OLD) - changeable) THEN
    RAISE EXCEPTION 'subscription period %: only its status and revocation can change', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF NOT ((OLD."status" = 'ACTIVE' AND NEW."status" IN ('EXPIRED', 'REVOKED'))
            OR (OLD."status" = 'EXPIRED' AND NEW."status" = 'REVOKED')) THEN
      RAISE EXCEPTION 'subscription period %: % -> % is not allowed', OLD."id", OLD."status", NEW."status"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  ELSIF NEW."revoked_at" IS DISTINCT FROM OLD."revoked_at"
        OR NEW."revocation_reason" IS DISTINCT FROM OLD."revocation_reason" THEN
    RAISE EXCEPTION 'subscription period %: a revocation cannot be changed', OLD."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "subscription_periods_history_guard"
  BEFORE UPDATE OR DELETE ON "subscription_periods"
  FOR EACH ROW EXECUTE FUNCTION "guard_subscription_period"();

CREATE TRIGGER "subscription_periods_no_truncate"
  BEFORE TRUNCATE ON "subscription_periods"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_truncate"();

-- Every revocation is a recorded correction: by the end of the transaction that
-- revokes a period, a decision correction must reference it with ACCESS_REVOKED
-- (who, when and why). Deferred so the period can be revoked first and the
-- correction inserted after it, in either order within the transaction.
CREATE FUNCTION "require_correction_for_revocation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "decision_corrections"
                 WHERE "subscription_period_id" = NEW."id" AND "access_effect" = 'ACCESS_REVOKED') THEN
    RAISE EXCEPTION 'subscription period % was revoked without a decision correction recording who and why', NEW."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "subscription_periods_revocation_needs_correction"
  AFTER UPDATE OF "status" ON "subscription_periods"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW."status" = 'REVOKED' AND OLD."status" <> 'REVOKED')
  EXECUTE FUNCTION "require_correction_for_revocation"();

-- -----------------------------------------------------------------------------
-- Runtime role privileges.
-- infra/postgres/init/01-roles-and-databases.sh gives studyverse_app row access
-- (SELECT, INSERT, UPDATE, DELETE) to every table the migrator creates. Narrow it
-- where history must not change, and keep the API away from Prisma's migration
-- bookkeeping, which only the migrator writes. Skipped where the role or table
-- doesn't exist (for example Prisma's shadow database, which has no
-- _prisma_migrations table).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'studyverse_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON "audit_logs" FROM studyverse_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON "decision_corrections" FROM studyverse_app;
    -- Rows the database never lets anyone delete (triggers above): no DELETE either.
    REVOKE DELETE, TRUNCATE ON "subscription_periods", "subscription_requests", "payment_submissions" FROM studyverse_app;
    IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
      REVOKE ALL ON "_prisma_migrations" FROM studyverse_app;
    END IF;
  END IF;
END
$$;
