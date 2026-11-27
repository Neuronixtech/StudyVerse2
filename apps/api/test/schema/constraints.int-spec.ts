import { describe, it } from "vitest";
import { expectAccepted, expectRefused, inRollback } from "../support/db.js";
import {
  createOrder,
  createPlan,
  createProduct,
  createTest,
  createUser,
} from "../support/fixtures.js";

// The remaining rules from extra-constraints.sql: starter CHECKs and partial indexes, and
// the tables added in D4.2.

describe("other database rules", () => {
  it("money, quantities and order arithmetic", async () => {
    await inRollback(async (db) => {
      const learner = await createUser(db);
      await expectRefused(
        db,
        "INSERT INTO subscription_plans (id, name, duration_days, price_paise, updated_at) VALUES (gen_random_uuid(), 'x', 0, 1, now())",
        /subscription_plans_duration_positive_check/,
      );
      await expectRefused(
        db,
        "INSERT INTO products (id, sku, slug, title, mrp_paise, selling_price_paise, updated_at) VALUES (gen_random_uuid(), 's', 's', 't', 100, 200, now())",
        /products_valid_price_check/,
      );
      const order = `INSERT INTO orders (id, order_number, user_id, item_subtotal_paise, shipping_paise, discount_paise, total_paise, address_snapshot, updated_at)
                     VALUES (gen_random_uuid(), $1, $2, 1000, 100, 0, $3, '{}', now())`;
      await expectAccepted(db, order, ["SV-OK", learner, 1100]);
      await expectRefused(db, order, /orders_total_check/, ["SV-BAD", learner, 999]);
      const orderId = await createOrder(db, learner);
      const book = await createProduct(db);
      await expectRefused(
        db,
        `INSERT INTO order_items (id, order_id, product_id, sku_snapshot, title_snapshot, mrp_paise_snapshot, unit_price_paise, quantity, line_total_paise)
         VALUES (gen_random_uuid(), $1, $2, 'S', 'T', 500, 450, 2, 901)`,
        /order_items_valid_quantities_and_amounts_check/,
        [orderId, book],
      );
    });
  });

  it("one designated free demo test", async () => {
    await inRollback(async (db) => {
      await createTest(db, { isFreeDemo: true });
      await expectRefused(
        db,
        "INSERT INTO tests (id, title, slug, kind, is_free_demo, updated_at) VALUES (gen_random_uuid(), 'D2', 'd2', 'PRACTICE', true, now())",
        /tests_single_free_demo/,
      );
    });
  });

  it("test kind is required and limited to full, sectional, chapter or practice", async () => {
    await inRollback(async (db) => {
      await expectRefused(
        db,
        "INSERT INTO tests (id, title, slug, updated_at) VALUES (gen_random_uuid(), 't', 't-nokind', now())",
        /null value in column "kind"/,
      );
      await expectRefused(
        db,
        "INSERT INTO tests (id, title, slug, kind, updated_at) VALUES (gen_random_uuid(), 't', 't-bad', 'MOCK', now())",
        /invalid input value for enum "TestKind"/,
      );
      for (const kind of ["FULL", "SECTIONAL", "CHAPTER", "PRACTICE"]) {
        await expectAccepted(
          db,
          "INSERT INTO tests (id, title, slug, kind, updated_at) VALUES (gen_random_uuid(), 't', $1, $2, now())",
          [`t-${kind}`, kind],
        );
      }
    });
  });

  it("normalized emails are unique; one default address per learner", async () => {
    await inRollback(async (db) => {
      await db.query(
        "INSERT INTO users (id, email, normalized_email, display_name, updated_at) VALUES (gen_random_uuid(), 'A@x.in', 'a@x.in', 'A', now())",
      );
      await expectRefused(
        db,
        "INSERT INTO users (id, email, normalized_email, display_name, updated_at) VALUES (gen_random_uuid(), 'a@X.in', 'a@x.in', 'A', now())",
        /users_normalized_email_key/,
      );
      const learner = await createUser(db);
      const address = `INSERT INTO addresses (id, user_id, full_name, mobile, address_line_1, locality, city, state, postal_code, is_default, updated_at)
                       VALUES (gen_random_uuid(), $1, 'A', '9', 'L1', 'Loc', 'Pune', 'MH', '411001', true, now())`;
      await expectAccepted(db, address, [learner]);
      await expectRefused(db, address, /addresses_one_default_per_user/, [learner]);
    });
  });

  it("idempotency records: one key per operation and actor, completed rows store an outcome", async () => {
    await inRollback(async (db) => {
      const insert = `INSERT INTO idempotency_records (id, operation, actor_key, idempotency_key, request_hash, status, response_status, completed_at, locked_until, expires_at)
                      VALUES (gen_random_uuid(), $1, 'user:1', 'k1', repeat('a', 64), $2, $3, $4, now() + interval '1 minute', now() + interval '1 day')`;
      await expectAccepted(db, insert, ["orders.create", "IN_PROGRESS", null, null]);
      await expectRefused(
        db,
        insert,
        /idempotency_records_operation_actor_key_idempotency_key_key/,
        ["orders.create", "IN_PROGRESS", null, null],
      );
      await expectAccepted(db, insert, ["payments.submit", "COMPLETED", 201, new Date()]);
      await expectRefused(db, insert, /idempotency_records_completed_check/, [
        "x.one",
        "COMPLETED",
        null,
        null,
      ]);
      await expectRefused(db, insert, /idempotency_records_response_status_check/, [
        "x.two",
        "COMPLETED",
        700,
        new Date(),
      ]);
    });
  });

  it("auth events: a failed sign-in records a reason; unknown accounts are tracked by email hash", async () => {
    await inRollback(async (db) => {
      await expectRefused(
        db,
        "INSERT INTO auth_events (id, type) VALUES (gen_random_uuid(), 'LOGIN_FAILED')",
        /auth_events_failure_reason_check/,
      );
      await expectAccepted(
        db,
        "INSERT INTO auth_events (id, type, method, failure_reason, email_hash) VALUES (gen_random_uuid(), 'LOGIN_FAILED', 'PASSWORD', 'INVALID_CREDENTIALS', repeat('b', 64))",
      );
    });
  });

  it("plans and subscription periods: valid ranges", async () => {
    await inRollback(async (db) => {
      const learner = await createUser(db);
      const plan = await createPlan(db);
      await expectRefused(
        db,
        "INSERT INTO subscription_periods (id, user_id, plan_id, starts_at, ends_at) VALUES (gen_random_uuid(), $1, $2, now(), now() - interval '1 day')",
        /subscription_periods_valid_range_check/,
        [learner, plan],
      );
    });
  });
});
