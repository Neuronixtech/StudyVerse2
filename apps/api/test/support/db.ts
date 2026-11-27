import pg from "pg";
import { expect } from "vitest";
import { TEST_DATABASE_MIGRATION_URL, TEST_DATABASE_URL } from "../setup/integration-env.js";

export type Db = pg.Client;

async function connect(url: string): Promise<Db> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

/** A connection as the API's runtime role (row access only), as the app would use. */
export const connectAsApp = () => connect(TEST_DATABASE_URL);
/** A connection as the migration (owner) role. */
export const connectAsMigrator = () => connect(TEST_DATABASE_MIGRATION_URL);

/**
 * Runs `work` in a transaction that is always rolled back, so a test leaves no rows
 * behind. Rules are checked as the app role unless a migrator connection is passed.
 */
export async function inRollback<T>(work: (db: Db) => Promise<T>, asMigrator = false): Promise<T> {
  const db = asMigrator ? await connectAsMigrator() : await connectAsApp();
  try {
    await db.query("BEGIN");
    return await work(db);
  } finally {
    await db.query("ROLLBACK").catch(() => undefined);
    await db.end();
  }
}

/** Runs `sql` inside a savepoint and expects the database to refuse it. */
export async function expectRefused(db: Db, sql: string, reason: RegExp, values?: unknown[]) {
  await db.query("SAVEPOINT probe");
  let error: unknown;
  try {
    await db.query(sql, values);
  } catch (caught) {
    error = caught;
  }
  await db.query("ROLLBACK TO SAVEPOINT probe");
  expect(error, `expected the database to refuse: ${sql}`).toBeInstanceOf(Error);
  expect(error instanceof Error ? error.message : String(error)).toMatch(reason);
}

/** Runs `sql` inside a savepoint, expects it to succeed, and keeps its effects. */
export async function expectAccepted(db: Db, sql: string, values?: unknown[]) {
  await db.query("SAVEPOINT probe");
  try {
    const result = await db.query(sql, values);
    await db.query("RELEASE SAVEPOINT probe");
    return result;
  } catch (error) {
    await db.query("ROLLBACK TO SAVEPOINT probe");
    throw error;
  }
}

/** Single value from the first row. */
export async function scalar<T>(db: Db, sql: string, values?: unknown[]): Promise<T> {
  const { rows } = await db.query<Record<string, T>>(sql, values);
  const row = rows[0];
  if (row === undefined) throw new Error(`no rows: ${sql}`);
  return Object.values(row)[0];
}

/** Waits until `pid` is blocked by another session's lock (proves real contention). */
export async function waitUntilBlocked(
  observer: Db,
  pid: number,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const blockers = await scalar<number[]>(observer, "SELECT pg_blocking_pids($1)", [pid]);
    if (blockers.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`session ${pid} never waited on a lock`);
}
