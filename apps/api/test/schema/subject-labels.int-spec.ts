import { describe, expect, it } from "vitest";
import { expectAccepted, expectRefused, inRollback, type Db } from "../support/db.js";
import {
  createSection,
  createSubject,
  createTest,
  createVersion,
  publish,
} from "../support/fixtures.js";

// Review requirement 4: a published test keeps the subject label it had at publication.
const LABELS = `
  SELECT s.sort_order, s.subject_id, s.subject_name_snapshot AS snapshot,
         COALESCE(s.subject_name_snapshot, sub.name) AS label
  FROM test_version_sections s LEFT JOIN subjects sub ON sub.id = s.subject_id
  WHERE s.test_version_id = $1 ORDER BY s.sort_order`;

const labels = async (db: Db, versionId: string) =>
  (
    await db.query<{
      sort_order: number;
      subject_id: string | null;
      snapshot: string | null;
      label: string | null;
    }>(LABELS, [versionId])
  ).rows;

describe("published subject labels", () => {
  it("drafts show the current subject name; publication snapshots it", async () => {
    await inRollback(async (db) => {
      const physics = await createSubject(db, "Physics");
      const versionId = await createVersion(db, await createTest(db));
      await createSection(db, versionId, { sortOrder: 1, subjectId: physics, title: "Section A" });
      await createSection(db, versionId, { sortOrder: 2, subjectId: null, title: "General" });

      expect(await labels(db, versionId)).toEqual([
        { sort_order: 1, subject_id: physics, snapshot: null, label: "Physics" },
        { sort_order: 2, subject_id: null, snapshot: null, label: null },
      ]);
      await db.query("UPDATE subjects SET name = 'Physics I' WHERE id = $1", [physics]);
      expect((await labels(db, versionId))[0]?.label).toBe("Physics I"); // still a draft

      await publish(db, versionId);
      expect(await labels(db, versionId)).toEqual([
        { sort_order: 1, subject_id: physics, snapshot: "Physics I", label: "Physics I" },
        { sort_order: 2, subject_id: null, snapshot: null, label: null },
      ]);
    });
  });

  it("renaming a subject doesn't relabel a published (or superseded) test; a new version uses the new name", async () => {
    await inRollback(async (db) => {
      const chemistry = await createSubject(db, "Chemistry");
      const testId = await createTest(db);
      const v1 = await createVersion(db, testId, { number: 1 });
      await createSection(db, v1, { sortOrder: 1, subjectId: chemistry });
      await publish(db, v1);

      await expectAccepted(db, "UPDATE subjects SET name = 'Organic Chemistry' WHERE id = $1", [
        chemistry,
      ]);
      expect((await labels(db, v1))[0]).toMatchObject({
        subject_id: chemistry,
        label: "Chemistry",
      });

      const v2 = await createVersion(db, testId, { number: 2 });
      await createSection(db, v2, { sortOrder: 1, subjectId: chemistry });
      expect((await labels(db, v2))[0]?.label).toBe("Organic Chemistry");
      await db.query("UPDATE test_versions SET status = 'SUPERSEDED' WHERE id = $1", [v1]);
      await publish(db, v2);

      expect((await labels(db, v1))[0]?.label).toBe("Chemistry");
      expect((await labels(db, v2))[0]?.label).toBe("Organic Chemistry");
    });
  });

  it("refuses changing a published snapshot, and a snapshot without a subject", async () => {
    await inRollback(async (db) => {
      const maths = await createSubject(db, "Mathematics");
      const versionId = await createVersion(db, await createTest(db));
      const section = await createSection(db, versionId, { sortOrder: 1, subjectId: maths });
      await expectRefused(
        db,
        "UPDATE test_version_sections SET subject_id = NULL, subject_name_snapshot = 'X' WHERE id = $1",
        /test_version_sections_subject_snapshot_check/,
        [section],
      );
      await publish(db, versionId);
      await expectRefused(
        db,
        "UPDATE test_version_sections SET subject_name_snapshot = 'Renamed' WHERE id = $1",
        /no longer a draft/,
        [section],
      );
    });
  });
});
