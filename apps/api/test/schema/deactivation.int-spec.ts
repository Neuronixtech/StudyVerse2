import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { expectAccepted, expectRefused, inRollback, scalar, type Db } from "../support/db.js";
import {
  createAttempt,
  createOrder,
  createPaymentSubmission,
  createPlan,
  createPublishedSectionalTest,
  createSubscriptionRequest,
  createUser,
} from "../support/fixtures.js";

// Approval condition B (database part): deactivation keeps every historical record and
// hard deletion is refused wherever the RESTRICT policy applies. Refusing sign-in,
// revoking sessions and invalidating tokens are application rules for Milestone 2
// (documented in prisma/README.md, "Account deletion and foreign keys").

async function addSessionAndToken(db: Db, userId: string) {
  await db.query(
    "INSERT INTO user_sessions (id, user_id, session_id, expires_at) VALUES (gen_random_uuid(), $1, $2, now() + interval '1 day')",
    [userId, `sid-${randomUUID()}`],
  );
  await db.query(
    "INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at) VALUES (gen_random_uuid(), $1, 'PASSWORD_RESET', $2, now() + interval '30 minutes')",
    [userId, randomUUID()],
  );
}

describe("learner deactivation", () => {
  it("requires a timestamp to deactivate", async () => {
    await inRollback(async (db) => {
      const learner = await createUser(db);
      await expectRefused(
        db,
        "UPDATE users SET status = 'DEACTIVATED' WHERE id = $1",
        /users_deactivation_check/,
        [learner],
      );
      await expectAccepted(
        db,
        "UPDATE users SET status = 'DEACTIVATED', deactivated_at = now() WHERE id = $1",
        [learner],
      );
    });
  });

  it("keeps attempts, payments, subscriptions, orders, audit logs, sessions and tokens intact", async () => {
    await inRollback(async (db) => {
      const learner = await createUser(db);
      const admin = await createUser(db);
      const t = await createPublishedSectionalTest(db);
      await createAttempt(db, {
        testId: t.testId,
        versionId: t.versionId,
        userId: learner,
        status: "SUBMITTED",
      });
      const order = await createOrder(db, learner);
      await createPaymentSubmission(db, order, { status: "APPROVED", reviewer: admin });
      const request = await createSubscriptionRequest(db, learner, await createPlan(db));
      await db.query(
        "UPDATE subscription_requests SET status = 'APPROVED', reviewed_by_id = $2, reviewed_at = now() WHERE id = $1",
        [request, admin],
      );
      await db.query(
        "INSERT INTO audit_logs (id, actor_user_id, action, target_type) VALUES (gen_random_uuid(), $1, 'profile.update', 'user')",
        [learner],
      );
      await addSessionAndToken(db, learner);

      const counts = `SELECT
        (SELECT count(*) FROM test_attempts WHERE user_id = $1)::int AS attempts,
        (SELECT count(*) FROM orders WHERE user_id = $1)::int AS orders,
        (SELECT count(*) FROM payment_submissions p JOIN orders o ON o.id = p.order_id WHERE o.user_id = $1)::int AS payments,
        (SELECT count(*) FROM subscription_requests WHERE user_id = $1)::int AS requests,
        (SELECT count(*) FROM audit_logs WHERE actor_user_id = $1)::int AS audit,
        (SELECT count(*) FROM user_sessions WHERE user_id = $1)::int AS sessions,
        (SELECT count(*) FROM auth_tokens WHERE user_id = $1)::int AS tokens`;
      const before = (await db.query(counts, [learner])).rows[0];
      await db.query(
        "UPDATE users SET status = 'DEACTIVATED', deactivated_at = now() WHERE id = $1",
        [learner],
      );
      expect((await db.query(counts, [learner])).rows[0]).toEqual(before);
      expect(before).toEqual({
        attempts: 1,
        orders: 1,
        payments: 1,
        requests: 1,
        audit: 1,
        sessions: 1,
        tokens: 1,
      });
      // Sessions and tokens are left in place by the database: revoking and consuming
      // them on deactivation is the Milestone 2 authentication service's job.
      expect(
        await scalar(
          db,
          "SELECT count(*)::int FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL",
          [learner],
        ),
      ).toBe(1);
    });
  });

  it.each([
    ["a test attempt", "test_attempts_user_id_fkey"],
    ["an order", "orders_user_id_fkey"],
    ["a subscription request", "subscription_requests_user_id_fkey"],
    ["a subscription period", "subscription_periods_user_id_fkey"],
    ["an audit log entry", "audit_logs_actor_user_id_fkey"],
    ["a payment decision", "payment_submissions_reviewed_by_id_fkey"],
    ["a role grant to someone else", "user_roles_assigned_by_fkey"],
  ])("refuses hard deletion of a user with %s", async (history, fkey) => {
    await inRollback(async (db) => {
      const user = await createUser(db);
      const other = await createUser(db);
      switch (history) {
        case "a test attempt": {
          const t = await createPublishedSectionalTest(db);
          await createAttempt(db, {
            testId: t.testId,
            versionId: t.versionId,
            userId: user,
            status: "SUBMITTED",
          });
          break;
        }
        case "an order":
          await createOrder(db, user);
          break;
        case "a subscription request":
          await createSubscriptionRequest(db, user, await createPlan(db));
          break;
        case "a subscription period":
          await db.query(
            "INSERT INTO subscription_periods (id, user_id, plan_id, starts_at, ends_at) VALUES (gen_random_uuid(), $1, $2, now(), now() + interval '30 days')",
            [user, await createPlan(db)],
          );
          break;
        case "an audit log entry":
          await db.query(
            "INSERT INTO audit_logs (id, actor_user_id, action, target_type) VALUES (gen_random_uuid(), $1, 'x', 'y')",
            [user],
          );
          break;
        case "a payment decision":
          await createPaymentSubmission(db, await createOrder(db, other), {
            status: "APPROVED",
            reviewer: user,
          });
          break;
        case "a role grant to someone else": {
          const role = await scalar<string>(
            db,
            "INSERT INTO roles (id, key, name) VALUES (gen_random_uuid(), $1, 'Learner') RETURNING id",
            [`role-${randomUUID()}`],
          );
          await db.query(
            "INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)",
            [other, role, user],
          );
          break;
        }
      }
      await expectRefused(db, "DELETE FROM users WHERE id = $1", new RegExp(fkey), [user]);
    });
  });

  it("a user with only account-owned data can be hard-deleted at the database level (CASCADE); the application never does this", async () => {
    await inRollback(async (db) => {
      const user = await createUser(db);
      await addSessionAndToken(db, user);
      await expectAccepted(db, "DELETE FROM users WHERE id = $1", [user]);
      expect(
        await scalar(db, "SELECT count(*)::int FROM user_sessions WHERE user_id = $1", [user]),
      ).toBe(0);
    });
  });
});
