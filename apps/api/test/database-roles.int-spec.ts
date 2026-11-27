import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_MIGRATION_URL, TEST_DATABASE_URL } from "./setup/integration-env.js";

// The roles created by infra/postgres/init/01-roles-and-databases.sh (§13.1): the API's
// role reads and writes rows but can't change the schema; the migrator owns it.
const PROBE_TABLE = "zz_role_probe";

async function asRole<T>(url: string, work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

const asApp = <T>(work: (client: pg.Client) => Promise<T>) => asRole(TEST_DATABASE_URL, work);
const asMigrator = <T>(work: (client: pg.Client) => Promise<T>) =>
  asRole(TEST_DATABASE_MIGRATION_URL, work);

describe("database roles", () => {
  beforeAll(async () => {
    await asMigrator((c) =>
      c.query(
        `DROP TABLE IF EXISTS ${PROBE_TABLE}; CREATE TABLE ${PROBE_TABLE} (id int PRIMARY KEY, v text)`,
      ),
    );
  });

  afterAll(async () => {
    await asMigrator((c) => c.query(`DROP TABLE IF EXISTS ${PROBE_TABLE}`));
  });

  it("neither role is a superuser or can create databases or roles", async () => {
    const { rows } = await asMigrator((c) =>
      c.query<{ rolname: string; rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }>(
        `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles
         WHERE rolname IN ('studyverse_app', 'studyverse_migrator') ORDER BY rolname`,
      ),
    );
    expect(rows).toEqual([
      { rolname: "studyverse_app", rolsuper: false, rolcreatedb: false, rolcreaterole: false },
      { rolname: "studyverse_migrator", rolsuper: false, rolcreatedb: false, rolcreaterole: false },
    ]);
  });

  it("the migrator owns the test database", async () => {
    const { rows } = await asMigrator((c) =>
      c.query<{ owner: string }>(
        "SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = current_database()",
      ),
    );
    expect(rows[0]?.owner).toBe("studyverse_migrator");
  });

  it("the app role can read and write the migrator's tables (default privileges)", async () => {
    await asApp(async (c) => {
      await c.query(`INSERT INTO ${PROBE_TABLE} VALUES (1, 'a')`);
      await c.query(`UPDATE ${PROBE_TABLE} SET v = 'b' WHERE id = 1`);
      const { rows } = await c.query<{ v: string }>(`SELECT v FROM ${PROBE_TABLE}`);
      expect(rows).toEqual([{ v: "b" }]);
      await c.query(`DELETE FROM ${PROBE_TABLE}`);
    });
  });

  it.each([
    ["create a table", "CREATE TABLE zz_app_table (id int)", /permission denied for schema public/],
    ["alter a table", `ALTER TABLE ${PROBE_TABLE} ADD COLUMN w int`, /must be owner/],
    ["drop a table", `DROP TABLE ${PROBE_TABLE}`, /must be owner/],
    ["truncate a table", `TRUNCATE ${PROBE_TABLE}`, /permission denied/],
  ])("the app role cannot %s", async (_action, sql, error) => {
    await expect(asApp((c) => c.query(sql))).rejects.toThrow(error);
  });
});
