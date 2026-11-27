import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA_DIR = fileURLToPath(new URL("../../../../prisma/", import.meta.url));
const INIT = "20261125070533_init";
const read = (path: string) => readFileSync(`${PRISMA_DIR}${path}`, "utf8");

// The behaviour of the migration is tested against PostgreSQL in test/schema; this
// checks its committed shape without a database.
describe("committed migrations", () => {
  it("has the initial migration and the provider lock", () => {
    const entries = readdirSync(`${PRISMA_DIR}migrations`).toSorted();
    expect(entries).toContain(INIT);
    expect(read("migrations/migration_lock.toml")).toContain('provider = "postgresql"');
  });

  it("runs the initial migration in one transaction", () => {
    const sql = read(`migrations/${INIT}/migration.sql`);
    const statements = sql
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("--"));
    expect(statements[0]).toBe("BEGIN;");
    expect(statements.at(-1)).toBe("COMMIT;");
    expect(sql.match(/^(BEGIN|COMMIT);$/gm)).toEqual(["BEGIN;", "COMMIT;"]);
  });

  it("contains prisma/extra-constraints.sql verbatim as its second part", () => {
    const sql = read(`migrations/${INIT}/migration.sql`);
    const marker = "-- Part 2: prisma/extra-constraints.sql (verbatim)\n";
    const start = sql.indexOf(marker);
    expect(start).toBeGreaterThan(0);
    const afterBanner = sql.indexOf("\n\n", start + marker.length) + 2;
    const custom = sql.slice(afterBanner, sql.lastIndexOf("\nCOMMIT;"));
    expect(custom).toBe(read("extra-constraints.sql").trimEnd() + "\n");
  });
});
