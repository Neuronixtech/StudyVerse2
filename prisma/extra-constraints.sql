-- PostgreSQL constraints Prisma Schema Language cannot currently express directly.
-- Add these statements to the initial Prisma-generated migration.sql before applying it.
-- Re-check generated enum/table names if you change @@map or enum names.

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
