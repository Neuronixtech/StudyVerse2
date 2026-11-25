import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { expectAccepted, expectRefused, inRollback, scalar } from "../support/db.js";
import {
  createOrder,
  createPaymentSubmission,
  createPlan,
  createSubscriptionRequest,
  createUser,
} from "../support/fixtures.js";

// Approval condition C: payment and subscription decisions are auditable and write-once.
const DECIDED = /was decided .* and cannot change/;
const EVIDENCE = /is payment or access evidence and cannot be deleted/;

describe("payment decisions", () => {
  it("requires a reviewer and time to decide, and a reason to reject", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      const order = await createOrder(db, await createUser(db));
      const payment = await createPaymentSubmission(db, order);
      await expectRefused(
        db,
        "UPDATE payment_submissions SET status = 'APPROVED' WHERE id = $1",
        /payment_submissions_decision_check/,
        [payment],
      );
      await expectRefused(
        db,
        "UPDATE payment_submissions SET status = 'REJECTED', reviewed_by_id = $2, reviewed_at = now() WHERE id = $1",
        /payment_submissions_rejection_reason_check/,
        [payment, admin],
      );
      await expectAccepted(
        db,
        "UPDATE payment_submissions SET status = 'APPROVED', reviewed_by_id = $2, reviewed_at = now() WHERE id = $1",
        [payment, admin],
      );
    });
  });

  it("lets an undecided submission be corrected before review", async () => {
    await inRollback(async (db) => {
      const payment = await createPaymentSubmission(
        db,
        await createOrder(db, await createUser(db)),
      );
      await expectAccepted(
        db,
        "UPDATE payment_submissions SET transaction_reference = 'UTR-FIXED' WHERE id = $1",
        [payment],
      );
    });
  });

  it.each([
    [
      "flip an approval to a rejection",
      "UPDATE payment_submissions SET status = 'REJECTED', rejection_reason = 'late' WHERE id = $1",
    ],
    ["change the reviewer", "UPDATE payment_submissions SET reviewed_by_id = $2 WHERE id = $1"],
    [
      "change the review time",
      "UPDATE payment_submissions SET reviewed_at = now() - interval '1 day' WHERE id = $1",
    ],
    [
      "change the amount or reference",
      "UPDATE payment_submissions SET amount_paise = 1, transaction_reference = 'X' WHERE id = $1",
    ],
    [
      "reopen it",
      "UPDATE payment_submissions SET status = 'SUBMITTED', reviewed_by_id = NULL, reviewed_at = NULL WHERE id = $1",
    ],
  ])("refuses to silently overwrite a decided payment: %s", async (_label, sql) => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      const other = await createUser(db);
      const payment = await createPaymentSubmission(
        db,
        await createOrder(db, await createUser(db)),
        {
          status: "APPROVED",
          reviewer: admin,
        },
      );
      await expectRefused(db, sql, DECIDED, sql.includes("$2") ? [payment, other] : [payment]);
    });
  });

  it("refuses to delete any payment submission, decided or not", async () => {
    await inRollback(async (db) => {
      const order = await createOrder(db, await createUser(db));
      const pending = await createPaymentSubmission(db, order);
      const rejected = await createPaymentSubmission(db, order, {
        status: "REJECTED",
        reviewer: await createUser(db),
        reason: "blurred",
      });
      await expectRefused(db, "DELETE FROM payment_submissions WHERE id = $1", EVIDENCE, [pending]);
      await expectRefused(db, "DELETE FROM payment_submissions WHERE id = $1", EVIDENCE, [
        rejected,
      ]);
    });
  });

  it("keeps every decision when the customer resubmits after a rejection (BOOKSTORE_SPEC §6.3)", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      const order = await createOrder(db, await createUser(db));
      await createPaymentSubmission(db, order, {
        status: "REJECTED",
        reviewer: admin,
        reason: "amount mismatch",
      });
      await createPaymentSubmission(db, order, { status: "APPROVED", reviewer: admin });
      const { rows } = await db.query(
        "SELECT status, rejection_reason, reviewed_by_id FROM payment_submissions WHERE order_id = $1 ORDER BY submitted_at, status DESC",
        [order],
      );
      expect(rows).toEqual([
        { status: "REJECTED", rejection_reason: "amount mismatch", reviewed_by_id: admin },
        { status: "APPROVED", rejection_reason: null, reviewed_by_id: admin },
      ]);
    });
  });

  it("refuses deleting the admin who made a decision (reviewer ON DELETE RESTRICT)", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      await createPaymentSubmission(db, await createOrder(db, await createUser(db)), {
        status: "APPROVED",
        reviewer: admin,
      });
      await expectRefused(
        db,
        "DELETE FROM users WHERE id = $1",
        /payment_submissions_reviewed_by_id_fkey/,
        [admin],
      );
    });
  });

  it("refuses TRUNCATE, even for the owner role", async () => {
    await inRollback(async (db) => {
      await expectRefused(db, "TRUNCATE payment_submissions", /cannot be truncated/);
    }, true);
  });
});

describe("subscription decisions", () => {
  it("requires a reviewer and time to decide, and a reason to reject", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      const request = await createSubscriptionRequest(
        db,
        await createUser(db),
        await createPlan(db),
      );
      await expectRefused(
        db,
        "UPDATE subscription_requests SET status = 'APPROVED' WHERE id = $1",
        /subscription_requests_decision_check/,
        [request],
      );
      await expectRefused(
        db,
        "UPDATE subscription_requests SET status = 'REJECTED', reviewed_by_id = $2, reviewed_at = now() WHERE id = $1",
        /subscription_requests_rejection_reason_check/,
        [request, admin],
      );
    });
  });

  it("makes a decided request write-once and undeletable", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      const request = await createSubscriptionRequest(
        db,
        await createUser(db),
        await createPlan(db),
      );
      await db.query(
        "UPDATE subscription_requests SET status = 'APPROVED', reviewed_by_id = $2, reviewed_at = now() WHERE id = $1",
        [request, admin],
      );
      await expectRefused(
        db,
        "UPDATE subscription_requests SET status = 'CANCELLED' WHERE id = $1",
        DECIDED,
        [request],
      );
      await expectRefused(
        db,
        "UPDATE subscription_requests SET rejection_reason = 'x' WHERE id = $1",
        DECIDED,
        [request],
      );
      await expectRefused(db, "DELETE FROM subscription_requests WHERE id = $1", EVIDENCE, [
        request,
      ]);
    });
  });

  it("allows one pending request per learner, and a new request after a rejection", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      const learner = await createUser(db);
      const plan = await createPlan(db);
      const first = await createSubscriptionRequest(db, learner, plan);
      await expectRefused(
        db,
        `INSERT INTO subscription_requests (id, user_id, plan_id, requested_duration_days, price_snapshot_paise, payment_method, amount_paid_paise, transaction_reference, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 30, 49900, 'UPI', 49900, 'UTR-2', now())`,
        /subscription_requests_one_pending_per_user/,
        [learner, plan],
      );
      await db.query(
        "UPDATE subscription_requests SET status = 'REJECTED', reviewed_by_id = $2, reviewed_at = now(), rejection_reason = 'no payment found' WHERE id = $1",
        [first, admin],
      );
      await createSubscriptionRequest(db, learner, plan);
      expect(
        await scalar<number>(
          db,
          "SELECT count(*)::int FROM subscription_requests WHERE user_id = $1",
          [learner],
        ),
      ).toBe(2);
    });
  });

  it("records the status history in subscription_request_events", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      const learner = await createUser(db);
      const request = await createSubscriptionRequest(db, learner, await createPlan(db));
      const event =
        "INSERT INTO subscription_request_events (id, request_id, from_status, to_status, actor_user_id, reason) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)";
      await expectAccepted(db, event, [request, null, "PENDING", learner, null]);
      await expectRefused(db, event, /subscription_request_events_rejection_reason_check/, [
        request,
        "PENDING",
        "REJECTED",
        admin,
        null,
      ]);
      await expectRefused(db, event, /subscription_request_events_transition_check/, [
        request,
        "PENDING",
        "PENDING",
        admin,
        null,
      ]);
      await expectAccepted(db, event, [request, "PENDING", "APPROVED", admin, null]);
    });
  });
});

describe("corrections the current model supports, without touching the original decision", () => {
  it("wrong rejection: an admin activates the subscription manually; the rejected request is unchanged", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      const learner = await createUser(db);
      const plan = await createPlan(db);
      const request = await createSubscriptionRequest(db, learner, plan);
      await db.query(
        "UPDATE subscription_requests SET status = 'REJECTED', reviewed_by_id = $2, reviewed_at = now(), rejection_reason = 'not found' WHERE id = $1",
        [request, admin],
      );
      await expectAccepted(
        db,
        `INSERT INTO subscription_periods (id, user_id, plan_id, starts_at, ends_at, activated_by_id)
         VALUES (gen_random_uuid(), $1, $2, now(), now() + interval '30 days', $3)`,
        [learner, plan, admin],
      );
      expect(
        await scalar(db, "SELECT status FROM subscription_requests WHERE id = $1", [request]),
      ).toBe("REJECTED");
    });
  });

  it("wrong approval: the period can be revoked; the approved request stays as the historical decision", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      const learner = await createUser(db);
      const plan = await createPlan(db);
      const request = await createSubscriptionRequest(db, learner, plan);
      await db.query(
        "UPDATE subscription_requests SET status = 'APPROVED', reviewed_by_id = $2, reviewed_at = now() WHERE id = $1",
        [request, admin],
      );
      const period = await scalar<string>(
        db,
        `INSERT INTO subscription_periods (id, user_id, plan_id, source_request_id, starts_at, ends_at, activated_by_id)
         VALUES (gen_random_uuid(), $1, $2, $3, now(), now() + interval '30 days', $4) RETURNING id`,
        [learner, plan, request, admin],
      );
      await expectAccepted(
        db,
        "UPDATE subscription_periods SET status = 'REVOKED', revoked_at = now(), revocation_reason = 'payment never arrived' WHERE id = $1",
        [period],
      );
      expect(
        await scalar(db, "SELECT status FROM subscription_requests WHERE id = $1", [request]),
      ).toBe("APPROVED");
      // Gap (documented, proposal pending): there is no column recording who revoked it.
      const columns = await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'subscription_periods' AND column_name LIKE 'revoked%'",
      );
      expect(columns.rows.map((r: { column_name: string }) => r.column_name)).toEqual([
        "revoked_at",
      ]);
    });
  });

  it("the audit trail of a correction is an audit_logs row whose actor can't be deleted", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      await expectAccepted(
        db,
        "INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata) VALUES ($1, $2, 'subscription.period.revoke', 'subscription_period', $3, '{\"reason\":\"payment never arrived\"}')",
        [randomUUID(), admin, randomUUID()],
      );
      await expectRefused(db, "DELETE FROM users WHERE id = $1", /audit_logs_actor_user_id_fkey/, [
        admin,
      ]);
    });
  });
});
