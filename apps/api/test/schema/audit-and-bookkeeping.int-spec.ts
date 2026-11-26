import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runPrisma } from "../setup/global-setup.js";
import { TEST_DATABASE_MIGRATION_URL } from "../setup/integration-env.js";
import {
  connectAsApp,
  connectAsMigrator,
  expectRefused,
  inRollback,
  type Db,
} from "../support/db.js";
import { createUser } from "../support/fixtures.js";

// Review requirement 2 (audit logs append-only) and 5 (migration bookkeeping is the
// migrator's alone), tested as the real roles.

describe("audit logs are append-only", () => {
  let app: Db;
  let migrator: Db;
  let entryId: string;
  let original: Record<string, unknown>;

  beforeAll(async () => {
    app = await connectAsApp();
    migrator = await connectAsMigrator();
    const actor = await createUser(app);
    entryId = randomUUID();
    // 1. The application role can insert an audit event (committed: it must survive).
    await app.query(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, request_id)
       VALUES ($1, $2, 'subscription.request.approve', 'subscription_request', $3, '{"plan":"30d"}', 'req-1')`,
      [entryId, actor, randomUUID()],
    );
    original = (await app.query("SELECT * FROM audit_logs WHERE id = $1", [entryId])).rows[0];
  });

  afterAll(async () => {
    await app.end();
    await migrator.end();
  });

  it("the application role can insert and read entries", () => {
    expect(original).toMatchObject({ id: entryId, action: "subscription.request.approve" });
  });

  it("the application role cannot update, delete or truncate them (no privilege)", async () => {
    await app.query("BEGIN");
    // 2-4. Each attempt is refused before any trigger runs.
    await expectRefused(
      app,
      "UPDATE audit_logs SET action = 'tampered' WHERE id = $1",
      /permission denied for table audit_logs/,
      [entryId],
    );
    await expectRefused(
      app,
      "DELETE FROM audit_logs WHERE id = $1",
      /permission denied for table audit_logs/,
      [entryId],
    );
    await expectRefused(app, "TRUNCATE audit_logs", /permission denied for table audit_logs/);
    await app.query("ROLLBACK");
  });

  it("even the owner role is stopped by the database (trigger), not only by privileges", async () => {
    await migrator.query("BEGIN");
    await expectRefused(
      migrator,
      "UPDATE audit_logs SET action = 'tampered' WHERE id = $1",
      /audit_logs is append-only/,
      [entryId],
    );
    await expectRefused(
      migrator,
      "DELETE FROM audit_logs WHERE id = $1",
      /audit_logs is append-only/,
      [entryId],
    );
    await expectRefused(migrator, "TRUNCATE audit_logs", /cannot be truncated/);
    await migrator.query("ROLLBACK");
  });

  it("the application role cannot switch the protection off or grant itself access", async () => {
    await app.query("BEGIN");
    await expectRefused(
      app,
      "ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_append_only",
      /must be owner/,
    );
    await expectRefused(app, 'DROP FUNCTION "forbid_change"() CASCADE', /must be owner/);
    // A role without grant rights gets only a warning ("no privileges were granted") from
    // PostgreSQL, so check that nothing changed rather than expecting an error.
    await app.query("GRANT UPDATE, DELETE ON audit_logs TO studyverse_app");
    const { rows } = await app.query<{ update: boolean; delete: boolean }>(
      `SELECT has_table_privilege('studyverse_app', 'audit_logs', 'UPDATE') AS update,
              has_table_privilege('studyverse_app', 'audit_logs', 'DELETE') AS delete`,
    );
    expect(rows[0]).toEqual({ update: false, delete: false });
    await app.query("ROLLBACK");
  });

  it("5. the original record is unchanged", async () => {
    const now = (await app.query("SELECT * FROM audit_logs WHERE id = $1", [entryId])).rows[0];
    expect(now).toEqual(original);
  });

  it("the actor of an audit entry can't be hard-deleted", async () => {
    await inRollback(async (db) => {
      await expectRefused(db, "DELETE FROM users WHERE id = $1", /audit_logs_actor_user_id_fkey/, [
        original.actor_user_id,
      ]);
    });
  });
});

describe("Prisma migration bookkeeping (_prisma_migrations)", () => {
  it("belongs to the migrator, and the application role has no access to it at all", async () => {
    await inRollback(async (db) => {
      const owner = await db.query(
        "SELECT tableowner FROM pg_tables WHERE tablename = '_prisma_migrations'",
      );
      expect(owner.rows[0]).toEqual({ tableowner: "studyverse_migrator" });
      for (const [sql, label] of [
        ["SELECT count(*) FROM _prisma_migrations", "read"],
        [
          "INSERT INTO _prisma_migrations (id, checksum, migration_name) VALUES ('x', 'x', 'fake')",
          "insert",
        ],
        ["UPDATE _prisma_migrations SET rolled_back_at = now()", "update"],
        ["DELETE FROM _prisma_migrations", "delete"],
        ["TRUNCATE _prisma_migrations", "truncate"],
      ]) {
        await expectRefused(db, sql, /permission denied for table _prisma_migrations/);
        expect(label).toBeTypeOf("string");
      }
    });
  });

  it("the migrator still reads it and runs the migration workflow", async () => {
    await inRollback(async (db) => {
      const { rows } = await db.query("SELECT migration_name FROM _prisma_migrations");
      expect(rows).toEqual([{ migration_name: "20261125070533_init" }]);
    }, true);
    expect(runPrisma(["migrate", "status"], TEST_DATABASE_MIGRATION_URL)).toContain(
      "Database schema is up to date",
    );
  });
});
