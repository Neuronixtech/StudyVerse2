import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runPrisma } from "../setup/global-setup.js";
import { TEST_DATABASE_MIGRATION_URL } from "../setup/integration-env.js";
import { connectAsMigrator, scalar, type Db } from "../support/db.js";

// global-setup.ts emptied the test database and ran `prisma migrate deploy`.
const EXTRA_SQL = readFileSync(
  fileURLToPath(new URL("../../../../prisma/extra-constraints.sql", import.meta.url)),
  "utf8",
);
const namesIn = (pattern: RegExp) => [...EXTRA_SQL.matchAll(pattern)].map((m) => m[1]).toSorted();

describe("initial migration on PostgreSQL", () => {
  let db: Db;

  beforeAll(async () => {
    db = await connectAsMigrator();
  });

  afterAll(async () => {
    await db.end();
  });

  it("runs on PostgreSQL 18", async () => {
    const version = await scalar<number>(db, "SELECT current_setting('server_version_num')::int");
    expect(Math.floor(version / 10_000)).toBe(18);
  });

  it("applied exactly the committed migration, completely", async () => {
    const { rows } = await db.query<{
      migration_name: string;
      finished: boolean;
      rolled_back: boolean;
    }>(
      `SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back
       FROM _prisma_migrations ORDER BY started_at`,
    );
    expect(rows).toEqual([
      { migration_name: "20261125070533_init", finished: true, rolled_back: false },
    ]);
  });

  it("a second deploy changes nothing", () => {
    expect(runPrisma(["migrate", "deploy"], TEST_DATABASE_MIGRATION_URL)).toContain(
      "No pending migrations to apply",
    );
    expect(runPrisma(["migrate", "status"], TEST_DATABASE_MIGRATION_URL)).toContain(
      "Database schema is up to date",
    );
  });

  it("the live database has no drift from the Prisma schema", () => {
    // --exit-code: 0 = no difference, 2 = difference (execFileSync throws on non-zero).
    const out = runPrisma(
      [
        "migrate",
        "diff",
        "--from-config-datasource",
        "--to-schema",
        "../../prisma/schema.prisma",
        "--script",
        "--exit-code",
      ],
      TEST_DATABASE_MIGRATION_URL,
    );
    expect(out).toContain("This is an empty migration");
  });

  it("creates every partial unique index named in extra-constraints.sql", async () => {
    const expected = namesIn(/CREATE UNIQUE INDEX "([a-z_]+)"/g);
    const { rows } = await db.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexdef LIKE '% WHERE %' ORDER BY 1",
    );
    expect(rows.map((r) => r.indexname)).toEqual(expected);
    expect(expected).toHaveLength(10);
  });

  it("creates every CHECK constraint named in extra-constraints.sql", async () => {
    const expected = namesIn(/ADD CONSTRAINT "([a-z_]+_check)"/g);
    const { rows } = await db.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint k JOIN pg_namespace n ON n.oid = k.connamespace
       WHERE n.nspname = 'public' AND k.contype = 'c' ORDER BY 1`,
    );
    expect(rows.map((r) => r.conname)).toEqual(expected);
    expect(expected).toHaveLength(42);
  });

  it("creates every trigger and function named in extra-constraints.sql", async () => {
    const triggers = await db.query<{ tgname: string }>(
      `SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND NOT t.tgisinternal ORDER BY 1`,
    );
    expect(triggers.rows.map((r) => r.tgname)).toEqual(
      namesIn(/CREATE (?:CONSTRAINT )?TRIGGER "([a-z_]+)"/g),
    );
    const functions = await db.query<{ proname: string }>(
      "SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' ORDER BY 1",
    );
    expect(functions.rows.map((r) => r.proname)).toEqual(namesIn(/CREATE FUNCTION "([a-z_]+)"/g));
  });

  it("is owned by the migrator; the app role gets exactly the intended privileges per table", async () => {
    // has_table_privilege() with a list is true if ANY listed privilege is held, so each
    // privilege is checked separately and compared as an exact set.
    const { rows } = await db.query<{ table: string; owner: string; privileges: string[] }>(
      `SELECT t.tablename AS table, t.tableowner AS owner,
              ARRAY(SELECT p FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p
                    WHERE has_table_privilege('studyverse_app', format('public.%I', t.tablename), p)) AS privileges
       FROM pg_tables t WHERE t.schemaname = 'public'`,
    );
    expect(rows.length).toBe(70); // 69 application tables + _prisma_migrations
    expect(rows.filter((r) => r.owner !== "studyverse_migrator")).toEqual([]);
    const ROW_ACCESS = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    const EXPECTED: Record<string, string[]> = {
      audit_logs: ["SELECT", "INSERT"], // append-only history
      decision_corrections: ["SELECT", "INSERT"], // append-only corrections
      subscription_periods: ["SELECT", "INSERT", "UPDATE"], // never deleted
      subscription_requests: ["SELECT", "INSERT", "UPDATE"], // never deleted
      payment_submissions: ["SELECT", "INSERT", "UPDATE"], // never deleted
      _prisma_migrations: [], // migration bookkeeping: migrator only
    };
    const unexpected = rows.filter(
      (r) => JSON.stringify(r.privileges) !== JSON.stringify(EXPECTED[r.table] ?? ROW_ACCESS),
    );
    expect(unexpected).toEqual([]);
  });
});
