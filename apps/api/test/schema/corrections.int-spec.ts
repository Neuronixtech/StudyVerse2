import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  connectAsApp,
  expectAccepted,
  expectRefused,
  inRollback,
  scalar,
  type Db,
} from "../support/db.js";
import {
  createOrder,
  createPaymentSubmission,
  createPlan,
  createSubscriptionRequest,
  createUser,
} from "../support/fixtures.js";

// Review requirement 3: decisions are corrected by an append-only record that references
// the original decision, which is never modified. A wrong approval that already granted
// access is undone by revoking the period it created, preserving the granted window.

/** Runs the deferred checks now, exactly as COMMIT would. */
const checkAsAtCommit = (db: Db) => db.query("SET CONSTRAINTS ALL IMMEDIATE");

async function decidedRequest(db: Db, status: "APPROVED" | "REJECTED") {
  const admin = await createUser(db);
  const learner = await createUser(db);
  const plan = await createPlan(db);
  const request = await createSubscriptionRequest(db, learner, plan);
  await db.query(
    `UPDATE subscription_requests SET status = $2, reviewed_by_id = $3, reviewed_at = now() - interval '2 days',
       rejection_reason = $4 WHERE id = $1`,
    [request, status, admin, status === "REJECTED" ? "payment not found" : null],
  );
  return { admin, learner, plan, request };
}

/** An approved request and the period its approval created. */
async function approvedWithPeriod(db: Db) {
  const r = await decidedRequest(db, "APPROVED");
  const period = await scalar<string>(
    db,
    `INSERT INTO subscription_periods (id, user_id, plan_id, source_request_id, starts_at, ends_at, activated_by_id)
     VALUES (gen_random_uuid(), $1, $2, $3, now() - interval '2 days', now() + interval '28 days', $4) RETURNING id`,
    [r.learner, r.plan, r.request, r.admin],
  );
  return { ...r, period };
}

/** The sanctioned correction of a wrong approval, as the subscriptions service will run it. */
async function reverseApproval(
  db: Db,
  request: string,
  period: string,
  admin: string,
  reason: string,
) {
  await db.query(
    "UPDATE subscription_periods SET status = 'REVOKED', revoked_at = now(), revocation_reason = $2 WHERE id = $1",
    [period, reason],
  );
  const correction = await scalar<string>(
    db,
    `INSERT INTO decision_corrections (id, kind, subscription_request_id, access_effect, subscription_period_id, reason, corrected_by_id)
     VALUES (gen_random_uuid(), 'SUBSCRIPTION_APPROVAL_REVERSED', $1, 'ACCESS_REVOKED', $2, $3, $4) RETURNING id`,
    [request, period, reason, admin],
  );
  await db.query(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata)
     VALUES (gen_random_uuid(), $1, 'subscription.approval.reverse', 'subscription_request', $2, jsonb_build_object('correction', $3::text))`,
    [admin, request, correction],
  );
  return correction;
}

const CURRENT_ACCESS = `SELECT count(*)::int FROM subscription_periods
  WHERE user_id = $1 AND status = 'ACTIVE' AND starts_at <= now() AND ends_at > now()`;

describe("correcting a wrong subscription approval that already granted access", () => {
  it("revokes the period, records who/when/why, and leaves the original decision and the granted window intact", async () => {
    await inRollback(async (db) => {
      const r = await approvedWithPeriod(db);
      const before = await db.query("SELECT * FROM subscription_requests WHERE id = $1", [
        r.request,
      ]);
      const window = await db.query(
        "SELECT starts_at, ends_at FROM subscription_periods WHERE id = $1",
        [r.period],
      );
      expect(await scalar(db, CURRENT_ACCESS, [r.learner])).toBe(1);

      const correction = await reverseApproval(
        db,
        r.request,
        r.period,
        r.admin,
        "UTR not found in the bank statement",
      );
      await checkAsAtCommit(db);

      // Access ends now; the learner keeps their account and history.
      expect(await scalar(db, CURRENT_ACCESS, [r.learner])).toBe(0);
      // The original decision is untouched (who approved, when, and that it was an approval).
      expect(
        (await db.query("SELECT * FROM subscription_requests WHERE id = $1", [r.request])).rows,
      ).toEqual(before.rows);
      // The granted window is preserved; the revocation is recorded alongside it.
      const period = (
        await db.query(
          "SELECT starts_at, ends_at, status, revoked_at FROM subscription_periods WHERE id = $1",
          [r.period],
        )
      ).rows[0];
      expect({ starts_at: period.starts_at, ends_at: period.ends_at }).toEqual(window.rows[0]);
      expect(period.status).toBe("REVOKED");
      expect(period.revoked_at).toBeInstanceOf(Date);

      // The learner's subscription history shows the period, its approval and the correction.
      const history = await db.query(
        `SELECT p.status, r.status AS approval, c.kind, c.reason, c.corrected_by_id, c.access_effect
         FROM subscription_periods p
         JOIN subscription_requests r ON r.id = p.source_request_id
         LEFT JOIN decision_corrections c ON c.subscription_period_id = p.id
         WHERE p.user_id = $1`,
        [r.learner],
      );
      expect(history.rows).toEqual([
        {
          status: "REVOKED",
          approval: "APPROVED",
          kind: "SUBSCRIPTION_APPROVAL_REVERSED",
          reason: "UTR not found in the bank statement",
          corrected_by_id: r.admin,
          access_effect: "ACCESS_REVOKED",
        },
      ]);
      // The action is audited.
      expect(
        await scalar(
          db,
          "SELECT count(*)::int FROM audit_logs WHERE action = 'subscription.approval.reverse' AND metadata->>'correction' = $1",
          [correction],
        ),
      ).toBe(1);
    });
  });

  it("refuses a revocation that no correction records, when the transaction commits", async () => {
    const db = await connectAsApp();
    try {
      await db.query("BEGIN");
      const r = await approvedWithPeriod(db);
      await db.query("COMMIT");

      await db.query("BEGIN");
      await db.query(
        "UPDATE subscription_periods SET status = 'REVOKED', revoked_at = now(), revocation_reason = 'quietly' WHERE id = $1",
        [r.period],
      );
      await expect(db.query("COMMIT")).rejects.toThrow(/revoked without a decision correction/);
      expect(
        await scalar(db, "SELECT status FROM subscription_periods WHERE id = $1", [r.period]),
      ).toBe("ACTIVE");
    } finally {
      await db.end();
    }
  });

  it("requires the correction to revoke the period that approval created", async () => {
    await inRollback(async (db) => {
      const r = await approvedWithPeriod(db);
      const other = await approvedWithPeriod(db);
      const insert = `INSERT INTO decision_corrections (id, kind, subscription_request_id, access_effect, subscription_period_id, reason, corrected_by_id)
                      VALUES (gen_random_uuid(), 'SUBSCRIPTION_APPROVAL_REVERSED', $1, $2, $3, 'wrong', $4)`;
      // The period is still active (not revoked first):
      await expectRefused(db, insert, /must revoke the period that approval created/, [
        r.request,
        "ACCESS_REVOKED",
        r.period,
        r.admin,
      ]);
      // Another learner's period:
      await db.query(
        "UPDATE subscription_periods SET status = 'REVOKED', revoked_at = now(), revocation_reason = 'x' WHERE id = $1",
        [other.period],
      );
      await expectRefused(db, insert, /belongs to another learner/, [
        r.request,
        "ACCESS_REVOKED",
        other.period,
        r.admin,
      ]);
      // No access adjustment at all:
      await expectRefused(db, insert, /decision_corrections_access_effect_check/, [
        r.request,
        "NONE",
        null,
        r.admin,
      ]);
    });
  });

  it("refuses a correction whose kind doesn't match the original decision", async () => {
    await inRollback(async (db) => {
      const rejected = await decidedRequest(db, "REJECTED");
      const approved = await approvedWithPeriod(db);
      await expectRefused(
        db,
        `INSERT INTO decision_corrections (id, kind, subscription_request_id, access_effect, reason, corrected_by_id)
         VALUES (gen_random_uuid(), 'SUBSCRIPTION_REJECTION_REVERSED', $1, 'NONE', 'x', $2)`,
        /reverses an REJECTED decision, but the decision is APPROVED/,
        [approved.request, approved.admin],
      );
      await db.query(
        "UPDATE subscription_periods SET status = 'REVOKED', revoked_at = now(), revocation_reason = 'x' WHERE id = $1",
        [approved.period],
      );
      const fake = await scalar<string>(
        db,
        `INSERT INTO subscription_periods (id, user_id, plan_id, starts_at, ends_at) VALUES (gen_random_uuid(), $1, $2, now(), now() + interval '1 day') RETURNING id`,
        [rejected.learner, rejected.plan],
      );
      await db.query(
        "UPDATE subscription_periods SET status = 'REVOKED', revoked_at = now(), revocation_reason = 'x' WHERE id = $1",
        [fake],
      );
      await expectRefused(
        db,
        `INSERT INTO decision_corrections (id, kind, subscription_request_id, access_effect, subscription_period_id, reason, corrected_by_id)
         VALUES (gen_random_uuid(), 'SUBSCRIPTION_APPROVAL_REVERSED', $1, 'ACCESS_REVOKED', $2, 'x', $3)`,
        /reverses an APPROVED decision, but the decision is REJECTED/,
        [rejected.request, fake, rejected.admin],
      );
    });
  });

  it("allows one correction per decision, with a non-blank reason", async () => {
    await inRollback(async (db) => {
      const r = await approvedWithPeriod(db);
      await expectRefused(
        db,
        `INSERT INTO decision_corrections (id, kind, subscription_request_id, access_effect, subscription_period_id, reason, corrected_by_id)
         VALUES (gen_random_uuid(), 'SUBSCRIPTION_APPROVAL_REVERSED', $1, 'ACCESS_REVOKED', $2, '   ', $3)`,
        /decision_corrections_reason_check|must revoke/,
        [r.request, r.period, r.admin],
      );
      await reverseApproval(db, r.request, r.period, r.admin, "first correction");
      await expectRefused(
        db,
        `INSERT INTO decision_corrections (id, kind, subscription_request_id, access_effect, reason, corrected_by_id)
         VALUES (gen_random_uuid(), 'SUBSCRIPTION_APPROVAL_REVERSED', $1, 'NONE', 'again', $2)`,
        /decision_corrections_subscription_request_id_key|decision_corrections_access_effect_check/,
        [r.request, r.admin],
      );
    });
  });
});

describe("correcting a wrong subscription rejection", () => {
  it("grants a new period activated by the correcting admin; the rejected request stays REJECTED", async () => {
    await inRollback(async (db) => {
      const r = await decidedRequest(db, "REJECTED");
      const period = await scalar<string>(
        db,
        `INSERT INTO subscription_periods (id, user_id, plan_id, starts_at, ends_at, activated_by_id)
         VALUES (gen_random_uuid(), $1, $2, now(), now() + interval '30 days', $3) RETURNING id`,
        [r.learner, r.plan, r.admin],
      );
      await expectAccepted(
        db,
        `INSERT INTO decision_corrections (id, kind, subscription_request_id, access_effect, subscription_period_id, reason, corrected_by_id)
         VALUES (gen_random_uuid(), 'SUBSCRIPTION_REJECTION_REVERSED', $1, 'ACCESS_GRANTED', $2, 'payment found later', $3)`,
        [r.request, period, r.admin],
      );
      await checkAsAtCommit(db);
      expect(
        await scalar(db, "SELECT status FROM subscription_requests WHERE id = $1", [r.request]),
      ).toBe("REJECTED");
      expect(await scalar(db, CURRENT_ACCESS, [r.learner])).toBe(1);
    });
  });

  it("refuses a granted period activated by someone else, or one sourced from another request", async () => {
    await inRollback(async (db) => {
      const r = await decidedRequest(db, "REJECTED");
      const otherAdmin = await createUser(db);
      const period = await scalar<string>(
        db,
        `INSERT INTO subscription_periods (id, user_id, plan_id, starts_at, ends_at, activated_by_id)
         VALUES (gen_random_uuid(), $1, $2, now(), now() + interval '30 days', $3) RETURNING id`,
        [r.learner, r.plan, otherAdmin],
      );
      await expectRefused(
        db,
        `INSERT INTO decision_corrections (id, kind, subscription_request_id, access_effect, subscription_period_id, reason, corrected_by_id)
         VALUES (gen_random_uuid(), 'SUBSCRIPTION_REJECTION_REVERSED', $1, 'ACCESS_GRANTED', $2, 'x', $3)`,
        /grants a new active period activated by the correcting admin/,
        [r.request, period, r.admin],
      );
    });
  });
});

describe("correcting a payment decision", () => {
  it("records the correction only: no access change, and the payment decision is untouched", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      const payment = await createPaymentSubmission(
        db,
        await createOrder(db, await createUser(db)),
        {
          status: "APPROVED",
          reviewer: admin,
        },
      );
      const before = (await db.query("SELECT * FROM payment_submissions WHERE id = $1", [payment]))
        .rows;
      const insert = `INSERT INTO decision_corrections (id, kind, payment_submission_id, access_effect, subscription_period_id, reason, corrected_by_id)
                      VALUES (gen_random_uuid(), 'PAYMENT_APPROVAL_REVERSED', $1, $2, NULL, 'amount never credited', $3)`;
      await expectRefused(db, insert, /decision_corrections_access_effect_check/, [
        payment,
        "ACCESS_REVOKED",
        admin,
      ]);
      await expectAccepted(db, insert, [payment, "NONE", admin]);
      expect(
        (await db.query("SELECT * FROM payment_submissions WHERE id = $1", [payment])).rows,
      ).toEqual(before);
      await expectRefused(
        db,
        `INSERT INTO decision_corrections (id, kind, payment_submission_id, access_effect, reason, corrected_by_id)
         VALUES (gen_random_uuid(), 'PAYMENT_REJECTION_REVERSED', $1, 'NONE', 'x', $2)`,
        /reverses an REJECTED decision, but the decision is APPROVED|decision_corrections_payment_submission_id_key/,
        [payment, admin],
      );
    });
  });

  it("refuses a correction that names both or neither decision", async () => {
    await inRollback(async (db) => {
      const admin = await createUser(db);
      // Neither: the validation trigger (BEFORE INSERT runs before CHECKs) finds no decision.
      await expectRefused(
        db,
        "INSERT INTO decision_corrections (id, kind, access_effect, reason, corrected_by_id) VALUES (gen_random_uuid(), 'PAYMENT_APPROVAL_REVERSED', 'NONE', 'x', $1)",
        /the decision is missing|decision_corrections_target_check/,
        [admin],
      );
      // Both: passes the trigger (the request is APPROVED too), so the CHECK must stop it.
      const r = await decidedRequest(db, "APPROVED");
      const payment = await createPaymentSubmission(db, await createOrder(db, r.learner), {
        status: "APPROVED",
        reviewer: admin,
      });
      await expectRefused(
        db,
        `INSERT INTO decision_corrections (id, kind, subscription_request_id, payment_submission_id, access_effect, reason, corrected_by_id)
         VALUES (gen_random_uuid(), 'PAYMENT_APPROVAL_REVERSED', $1, $2, 'NONE', 'x', $3)`,
        /decision_corrections_target_check/,
        [r.request, payment, admin],
      );
    });
  });
});

describe("corrections and access periods keep their history", () => {
  it("corrections are append-only for the app role (no privilege) and the owner (trigger)", async () => {
    let correction = "";
    await inRollback(async (db) => {
      const r = await approvedWithPeriod(db);
      correction = await reverseApproval(db, r.request, r.period, r.admin, "wrong approval");
      await expectRefused(
        db,
        "UPDATE decision_corrections SET reason = 'edited' WHERE id = $1",
        /permission denied/,
        [correction],
      );
      await expectRefused(
        db,
        "DELETE FROM decision_corrections WHERE id = $1",
        /permission denied/,
        [correction],
      );
      await expectRefused(db, "TRUNCATE decision_corrections", /permission denied/);
      await expectRefused(
        db,
        "DELETE FROM users WHERE id = $1",
        /decision_corrections_corrected_by_id_fkey|violates RESTRICT/,
        [r.admin],
      );
    });
    await inRollback(async (db) => {
      const r = await approvedWithPeriod(db);
      correction = await reverseApproval(db, r.request, r.period, r.admin, "wrong approval");
      await expectRefused(
        db,
        "UPDATE decision_corrections SET reason = 'edited' WHERE id = $1",
        /decision_corrections is append-only/,
        [correction],
      );
      await expectRefused(
        db,
        "DELETE FROM decision_corrections WHERE id = $1",
        /decision_corrections is append-only/,
        [correction],
      );
      await expectRefused(db, "TRUNCATE decision_corrections", /cannot be truncated/);
    }, true);
  });

  it("a period's granted window, learner and source never change, and it can't be deleted", async () => {
    await inRollback(async (db) => {
      const r = await approvedWithPeriod(db);
      const other = await createUser(db);
      const ONLY_STATUS = /only its status and revocation can change/;
      await expectRefused(
        db,
        "UPDATE subscription_periods SET ends_at = ends_at + interval '30 days' WHERE id = $1",
        ONLY_STATUS,
        [r.period],
      );
      await expectRefused(
        db,
        "UPDATE subscription_periods SET starts_at = now() WHERE id = $1",
        ONLY_STATUS,
        [r.period],
      );
      await expectRefused(
        db,
        "UPDATE subscription_periods SET user_id = $2 WHERE id = $1",
        ONLY_STATUS,
        [r.period, other],
      );
      await expectRefused(
        db,
        "DELETE FROM subscription_periods WHERE id = $1",
        /permission denied/,
        [r.period],
      );
    });
    await inRollback(async (db) => {
      const r = await approvedWithPeriod(db);
      await expectRefused(
        db,
        "DELETE FROM subscription_periods WHERE id = $1",
        /access history and cannot be deleted/,
        [r.period],
      );
      await expectRefused(db, "TRUNCATE subscription_periods CASCADE", /cannot be truncated/);
    }, true);
  });

  it("allows only ACTIVE -> EXPIRED, then -> REVOKED; a revocation is final", async () => {
    await inRollback(async (db) => {
      const r = await approvedWithPeriod(db);
      await expectAccepted(db, "UPDATE subscription_periods SET status = 'EXPIRED' WHERE id = $1", [
        r.period,
      ]);
      await expectRefused(
        db,
        "UPDATE subscription_periods SET status = 'ACTIVE' WHERE id = $1",
        /EXPIRED -> ACTIVE is not allowed/,
        [r.period],
      );
      await reverseApproval(
        db,
        r.request,
        r.period,
        r.admin,
        "expired, but should never have been granted",
      );
      await checkAsAtCommit(db);
      await expectRefused(
        db,
        "UPDATE subscription_periods SET status = 'ACTIVE', revoked_at = NULL, revocation_reason = NULL WHERE id = $1",
        /REVOKED -> ACTIVE is not allowed/,
        [r.period],
      );
      await expectRefused(
        db,
        "UPDATE subscription_periods SET revocation_reason = 'reworded' WHERE id = $1",
        /a revocation cannot be changed/,
        [r.period],
      );
      await expectRefused(
        db,
        "UPDATE subscription_periods SET status = 'REVOKED', revoked_at = NULL WHERE id = $1",
        /subscription_periods_revocation_check|cannot be changed/,
        [r.period],
      );
    });
  });

  it("refuses a revocation without a time or reason", async () => {
    await inRollback(async (db) => {
      const r = await approvedWithPeriod(db);
      await expectRefused(
        db,
        "UPDATE subscription_periods SET status = 'REVOKED' WHERE id = $1",
        /subscription_periods_revocation_check/,
        [r.period],
      );
      expect(randomUUID()).toBeTypeOf("string");
    });
  });
});
