import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { expectAccepted, expectRefused, inRollback, scalar } from "../support/db.js";
import {
  createAttempt,
  createPublishedSectionalTest,
  createQuestion,
  createSection,
  createSubject,
  createTest,
  createVersion,
} from "../support/fixtures.js";

// Approval condition A: publication protects the whole version-owned structure, and
// only releasing solutions and superseding remain possible.
const FROZEN = /no longer a draft|so its configuration cannot change|so it cannot be deleted/;
const NO_TRUNCATE = /cannot be truncated/;

describe("test versions: sections while a DRAFT", () => {
  it("represents ordered, subject-linked, individually timed sections with assigned questions", async () => {
    await inRollback(async (db) => {
      const { versionId } = await createPublishedSectionalTest(db);
      const { rows } = await db.query(
        `SELECT s.sort_order, s.duration_seconds, sub.name AS subject, count(q.id)::int AS questions
         FROM test_version_sections s JOIN subjects sub ON sub.id = s.subject_id
         LEFT JOIN test_version_questions q ON q.section_id = s.id
         WHERE s.test_version_id = $1 GROUP BY s.id, sub.name ORDER BY s.sort_order`,
        [versionId],
      );
      expect(rows).toEqual([
        { sort_order: 1, duration_seconds: 480, subject: "Physics", questions: 2 },
        { sort_order: 2, duration_seconds: 480, subject: "Chemistry", questions: 2 },
        { sort_order: 3, duration_seconds: 480, subject: "Mathematics", questions: 2 },
      ]);
    });
  });

  it("lets a draft be edited freely", async () => {
    await inRollback(async (db) => {
      const versionId = await createVersion(db, await createTest(db));
      const a = await createSection(db, versionId, { sortOrder: 1 });
      const b = await createSection(db, versionId, { sortOrder: 2 });
      const q = await createQuestion(db, versionId, { order: 1, sectionId: a });
      await expectAccepted(
        db,
        "UPDATE test_version_sections SET duration_seconds = 600, title = 'Physics' WHERE id = $1",
        [a],
      );
      await expectAccepted(
        db,
        "UPDATE test_version_questions SET section_id = $1, question_order = 5 WHERE id = $2",
        [b, q],
      );
      await expectAccepted(
        db,
        "UPDATE test_versions SET marking_config = '{\"correct\":3}' WHERE id = $1",
        [versionId],
      );
      await expectAccepted(db, "DELETE FROM test_version_questions WHERE id = $1", [q]);
      await expectAccepted(db, "DELETE FROM test_version_sections WHERE id = $1", [a]);
    });
  });

  it("refuses a question in a section of another version", async () => {
    await inRollback(async (db) => {
      const testId = await createTest(db);
      const v1 = await createVersion(db, testId, { number: 1 });
      const v2 = await createVersion(db, testId, { number: 2 });
      const otherSection = await createSection(db, v2, { sortOrder: 1 });
      await expectRefused(
        db,
        `INSERT INTO test_version_questions (id, test_version_id, section_id, question_order, type, prompt_snapshot, answer_key_snapshot, marking_snapshot)
         VALUES (gen_random_uuid(), $1, $2, 1, 'NUMERICAL', '{}', '{}', '{}')`,
        /test_version_questions_section_id_test_version_id_fkey/,
        [v1, otherSection],
      );
    });
  });

  it("allows questions without a section (a test without sections)", async () => {
    await inRollback(async (db) => {
      const versionId = await createVersion(db, await createTest(db), { timingMode: "OVERALL" });
      await createQuestion(db, versionId, { order: 1, sectionId: null });
    });
  });

  it("refuses deleting a section that still has questions; a whole draft version cascades", async () => {
    await inRollback(async (db) => {
      const versionId = await createVersion(db, await createTest(db));
      const s = await createSection(db, versionId, { sortOrder: 1 });
      await createQuestion(db, versionId, { order: 1, sectionId: s });
      await expectRefused(
        db,
        "DELETE FROM test_version_sections WHERE id = $1",
        /violates foreign key/,
        [s],
      );
      await expectAccepted(db, "DELETE FROM test_versions WHERE id = $1", [versionId]);
      expect(
        await scalar<number>(
          db,
          "SELECT count(*)::int FROM test_version_sections WHERE test_version_id = $1",
          [versionId],
        ),
      ).toBe(0);
    });
  });
});

describe("test versions: a PUBLISHED version is frozen", () => {
  it.each([
    [
      "change a section timer",
      "UPDATE test_version_sections SET duration_seconds = 900 WHERE id = $S1",
    ],
    [
      "change section order",
      "UPDATE test_version_sections SET sort_order = 4 - sort_order WHERE test_version_id = $V",
    ],
    [
      "change a section's subject",
      "UPDATE test_version_sections SET subject_id = $SUBJ2 WHERE id = $S1",
    ],
    [
      "change a section's title or instructions",
      "UPDATE test_version_sections SET title = 'X', instructions = 'Y' WHERE id = $S1",
    ],
    [
      "add a section",
      "INSERT INTO test_version_sections (id, test_version_id, title, sort_order) VALUES (gen_random_uuid(), $V, 'Extra', 9)",
    ],
    ["delete a section", "DELETE FROM test_version_sections WHERE id = $S3"],
    [
      "reassign a question to another section",
      "UPDATE test_version_questions SET section_id = $S2 WHERE id = $Q1",
    ],
    [
      "remove a question from its section",
      "UPDATE test_version_questions SET section_id = NULL WHERE id = $Q1",
    ],
    ["reorder questions", "UPDATE test_version_questions SET question_order = 99 WHERE id = $Q1"],
    [
      "edit a question's answer key",
      'UPDATE test_version_questions SET answer_key_snapshot = \'{"key":"b"}\' WHERE id = $Q1',
    ],
    [
      "edit a question's marking",
      "UPDATE test_version_questions SET marking_snapshot = '{\"correct\":1}' WHERE id = $Q1",
    ],
    [
      "add a question",
      "INSERT INTO test_version_questions (id, test_version_id, question_order, type, prompt_snapshot, answer_key_snapshot, marking_snapshot) VALUES (gen_random_uuid(), $V, 50, 'NUMERICAL', '{}', '{}', '{}')",
    ],
    ["delete a question", "DELETE FROM test_version_questions WHERE id = $Q1"],
    [
      "change the marking scheme",
      "UPDATE test_versions SET marking_config = '{\"correct\":1}' WHERE id = $V",
    ],
    [
      "change the overall duration or timing mode",
      "UPDATE test_versions SET duration_seconds = 60, timing_mode = 'OVERALL' WHERE id = $V",
    ],
    [
      "change the result release mode",
      "UPDATE test_versions SET result_release_mode = 'MANUAL' WHERE id = $V",
    ],
    ["change the attempt limit", "UPDATE test_versions SET attempt_limit = 1 WHERE id = $V"],
    ["move the version to another test", "UPDATE test_versions SET test_id = $T2 WHERE id = $V"],
    ["move it back to DRAFT", "UPDATE test_versions SET status = 'DRAFT' WHERE id = $V"],
    ["delete the version", "DELETE FROM test_versions WHERE id = $V"],
  ])("refuses: %s", async (_label, template) => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      const otherTest = await createTest(db);
      const extraSubject = await createSubject(db, "Biology");
      const sql = template
        .replaceAll("$V", `'${t.versionId}'`)
        .replaceAll("$S1", `'${t.sections[0]}'`)
        .replaceAll("$S2", `'${t.sections[1]}'`)
        .replaceAll("$S3", `'${t.sections[2]}'`)
        .replaceAll("$Q1", `'${t.questions[0]}'`)
        .replaceAll("$SUBJ2", `'${extraSubject}'`)
        .replaceAll("$T2", `'${otherTest}'`);
      await expectRefused(db, sql, FROZEN);
    });
  });

  it("refuses changes that would reach it through cascades from related tables", async () => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      // Deleting the test that owns it (FK RESTRICT) or a subject a section uses (RESTRICT).
      await expectRefused(db, "DELETE FROM tests WHERE id = $1", /violates RESTRICT/, [t.testId]);
      await expectRefused(db, "DELETE FROM subjects WHERE id = $1", /violates RESTRICT/, [
        t.subjects[0],
      ]);
    });
  });

  it("keeps its question snapshot when the question bank changes, and blocks deleting the source", async () => {
    await inRollback(async (db) => {
      const bankId = randomUUID();
      await db.query(
        "INSERT INTO question_bank_items (id, type, prompt, updated_at) VALUES ($1, 'SINGLE_CHOICE', '{\"text\":\"v1\"}', now())",
        [bankId],
      );
      const versionId = await createVersion(db, await createTest(db), { timingMode: "OVERALL" });
      const q = await createQuestion(db, versionId, { order: 1, sourceQuestionId: bankId });
      await db.query("UPDATE test_versions SET status = 'PUBLISHED' WHERE id = $1", [versionId]);
      await expectAccepted(
        db,
        'UPDATE question_bank_items SET prompt = \'{"text":"v2"}\' WHERE id = $1',
        [bankId],
      );
      expect(
        await scalar(
          db,
          "SELECT prompt_snapshot->>'text' FROM test_version_questions WHERE id = $1",
          [q],
        ),
      ).toBe("Q");
      // ON DELETE SET NULL would rewrite the published question: refused.
      await expectRefused(db, "DELETE FROM question_bank_items WHERE id = $1", FROZEN, [bankId]);
    });
  });

  it("still allows the two permitted changes: releasing solutions, then superseding", async () => {
    await inRollback(async (db) => {
      const { versionId } = await createPublishedSectionalTest(db);
      await expectAccepted(
        db,
        "UPDATE test_versions SET answer_review_release_at = now() WHERE id = $1",
        [versionId],
      );
      await expectAccepted(
        db,
        "UPDATE test_versions SET answer_review_release_at = NULL WHERE id = $1",
        [versionId],
      );
      await expectAccepted(db, "UPDATE test_versions SET status = 'SUPERSEDED' WHERE id = $1", [
        versionId,
      ]);
      await expectRefused(
        db,
        "UPDATE test_versions SET status = 'PUBLISHED' WHERE id = $1",
        FROZEN,
        [versionId],
      );
    });
  });

  it("leaves test-level metadata editable (title, kind, classification)", async () => {
    await inRollback(async (db) => {
      const { testId } = await createPublishedSectionalTest(db);
      await expectAccepted(db, "UPDATE tests SET title = 'Renamed', kind = 'FULL' WHERE id = $1", [
        testId,
      ]);
    });
  });

  it.each([
    "TRUNCATE test_version_questions CASCADE",
    "TRUNCATE test_version_sections CASCADE",
    "TRUNCATE test_versions CASCADE",
    "TRUNCATE tests CASCADE",
  ])("refuses %s even for the owner role", async (sql) => {
    await inRollback(async (db) => {
      await createPublishedSectionalTest(db);
      await expectRefused(db, sql, NO_TRUNCATE);
    }, true);
  });

  it("can't be unprotected by the app role", async () => {
    await inRollback(async (db) => {
      await expectRefused(
        db,
        "ALTER TABLE test_version_questions DISABLE TRIGGER ALL",
        /must be owner/,
      );
      await expectRefused(
        db,
        'DROP FUNCTION "guard_published_test_version_content"() CASCADE',
        /must be owner/,
      );
      await expectRefused(db, "TRUNCATE test_version_questions", /permission denied/);
    });
  });
});

describe("attempt section state (server-side section timers)", () => {
  it("records time used per section and locks an expired section", async () => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      const attempt = await createAttempt(db, {
        testId: t.testId,
        versionId: t.versionId,
        guest: "g-1",
      });
      await expectAccepted(
        db,
        `INSERT INTO attempt_section_states (id, attempt_id, section_id, first_entered_at, elapsed_ms, locked_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, now() - interval '9 minutes', 480000, now() - interval '1 minute', now()),
                (gen_random_uuid(), $1, $3, now() - interval '1 minute', 0, NULL, now())`,
        [attempt, t.sections[0], t.sections[1]],
      );
      await expectAccepted(
        db,
        "UPDATE attempt_section_states SET active_since = now() WHERE attempt_id = $1 AND section_id = $2",
        [attempt, t.sections[1]],
      );
    });
  });

  it("refuses two active sections, a locked active section, or negative time", async () => {
    await inRollback(async (db) => {
      const t = await createPublishedSectionalTest(db);
      const attempt = await createAttempt(db, {
        testId: t.testId,
        versionId: t.versionId,
        guest: "g-2",
      });
      const insert = `INSERT INTO attempt_section_states (id, attempt_id, section_id, active_since, locked_at, elapsed_ms, updated_at)
                      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`;
      await expectAccepted(db, insert, [attempt, t.sections[0], new Date(), null, 0]);
      await expectRefused(db, insert, /attempt_section_states_one_active_per_attempt/, [
        attempt,
        t.sections[1],
        new Date(),
        null,
        0,
      ]);
      await expectRefused(db, insert, /attempt_section_states_valid_state_check/, [
        attempt,
        t.sections[2],
        new Date(),
        new Date(),
        0,
      ]);
      await expectRefused(db, insert, /attempt_section_states_valid_state_check/, [
        attempt,
        t.sections[2],
        null,
        null,
        -1,
      ]);
      await expectRefused(db, insert, /attempt_section_states_attempt_id_section_id_key/, [
        attempt,
        t.sections[0],
        null,
        null,
        0,
      ]);
    });
  });
});
