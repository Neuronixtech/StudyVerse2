import { describe, expect, it } from "vitest";
import { expectAccepted, expectRefused, inRollback, scalar } from "../support/db.js";
import {
  createAttempt,
  createPublishedSectionalTest,
  createTest,
  createUser,
} from "../support/fixtures.js";

// Guest demo attempts and retakes (approved D4.1), one in-progress attempt per actor
// per test (66b1a27), exactly one actor per attempt.

describe("test attempts", () => {
  it("lets a guest retake the free demo, numbering attempts per guest and test", async () => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      await db.query("UPDATE tests SET is_free_demo = true WHERE id = $1", [t.testId]);
      const base = { testId: t.testId, versionId: t.versionId, guest: "guest-a" };
      await createAttempt(db, { ...base, number: 1, status: "SUBMITTED" });
      await createAttempt(db, { ...base, number: 2, status: "SUBMITTED" });
      await createAttempt(db, { ...base, number: 3 });
      // Another guest starts at 1 too.
      await createAttempt(db, { ...base, guest: "guest-b", number: 1 });
      expect(
        await scalar<number>(
          db,
          "SELECT count(*)::int FROM test_attempts WHERE guest_token_hash = 'guest-a'",
        ),
      ).toBe(3);
    });
  });

  it("refuses a reused attempt number for the same guest and test", async () => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      await createAttempt(db, {
        testId: t.testId,
        versionId: t.versionId,
        guest: "g",
        number: 1,
        status: "SUBMITTED",
      });
      await expectRefused(
        db,
        `INSERT INTO test_attempts (id, test_id, test_version_id, guest_token_hash, status, attempt_number, expires_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'g', 'SUBMITTED', 1, now() + interval '1 hour', now())`,
        /test_attempts_guest_token_hash_test_id_attempt_number_key/,
        [t.testId, t.versionId],
      );
    });
  });

  it("allows one in-progress attempt per learner and per guest for a test", async () => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      const learner = await createUser(db);
      const start = `INSERT INTO test_attempts (id, test_id, test_version_id, user_id, guest_token_hash, status, attempt_number, expires_at, updated_at)
                     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'IN_PROGRESS', $5, now() + interval '1 hour', now())`;
      await expectAccepted(db, start, [t.testId, t.versionId, learner, null, 1]);
      await expectRefused(db, start, /test_attempts_one_in_progress_per_user/, [
        t.testId,
        t.versionId,
        learner,
        null,
        2,
      ]);
      await expectAccepted(db, start, [t.testId, t.versionId, null, "g", 1]);
      await expectRefused(db, start, /test_attempts_one_in_progress_per_guest/, [
        t.testId,
        t.versionId,
        null,
        "g",
        2,
      ]);
      // A different test is independent.
      const otherTest = await createTest(db);
      const otherVersion = await scalar<string>(
        db,
        `INSERT INTO test_versions (id, test_id, version_number, timing_mode, duration_seconds, marking_config, updated_at)
         VALUES (gen_random_uuid(), $1, 1, 'OVERALL', 600, '{}', now()) RETURNING id`,
        [otherTest],
      );
      await expectAccepted(db, start, [otherTest, otherVersion, learner, null, 1]);
    });
  });

  it("allows a retake once the previous attempt is finished", async () => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      const learner = await createUser(db);
      const first = await createAttempt(db, {
        testId: t.testId,
        versionId: t.versionId,
        userId: learner,
      });
      await db.query(
        "UPDATE test_attempts SET status = 'AUTO_SUBMITTED', submitted_at = now() WHERE id = $1",
        [first],
      );
      await createAttempt(db, {
        testId: t.testId,
        versionId: t.versionId,
        userId: learner,
        number: 2,
      });
    });
  });

  it("requires exactly one actor: a learner or a guest", async () => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      const learner = await createUser(db);
      const insert = `INSERT INTO test_attempts (id, test_id, test_version_id, user_id, guest_token_hash, attempt_number, expires_at, updated_at)
                      VALUES (gen_random_uuid(), $1, $2, $3, $4, 1, now() + interval '1 hour', now())`;
      await expectRefused(db, insert, /test_attempts_exactly_one_actor_check/, [
        t.testId,
        t.versionId,
        learner,
        "g",
      ]);
      await expectRefused(db, insert, /test_attempts_exactly_one_actor_check/, [
        t.testId,
        t.versionId,
        null,
        null,
      ]);
    });
  });

  it("supports claiming guest attempts on sign-in (renumbered after the learner's own)", async () => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      const learner = await createUser(db);
      const base = { testId: t.testId, versionId: t.versionId };
      await createAttempt(db, { ...base, userId: learner, number: 1, status: "SUBMITTED" });
      const g1 = await createAttempt(db, { ...base, guest: "g", number: 1, status: "SUBMITTED" });
      const g2 = await createAttempt(db, { ...base, guest: "g", number: 2, status: "SUBMITTED" });
      for (const id of [g1, g2]) {
        await expectAccepted(
          db,
          `UPDATE test_attempts SET user_id = $1, guest_token_hash = NULL,
             attempt_number = (SELECT max(attempt_number) + 1 FROM test_attempts WHERE user_id = $1 AND test_id = $2)
           WHERE id = $3`,
          [learner, t.testId, id],
        );
      }
      const { rows } = await db.query(
        "SELECT attempt_number FROM test_attempts WHERE user_id = $1 ORDER BY 1",
        [learner],
      );
      expect(rows.map((r: { attempt_number: number }) => r.attempt_number)).toEqual([1, 2, 3]);
    });
  });

  it("keeps the attempt bound to its exact version and refuses deleting a learner who has attempts", async () => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      const learner = await createUser(db);
      await createAttempt(db, {
        testId: t.testId,
        versionId: t.versionId,
        userId: learner,
        status: "SUBMITTED",
      });
      await expectRefused(db, "DELETE FROM test_versions WHERE id = $1", /cannot be deleted/, [
        t.versionId,
      ]);
      await expectRefused(db, "DELETE FROM users WHERE id = $1", /test_attempts_user_id_fkey/, [
        learner,
      ]);
    });
  });
});
