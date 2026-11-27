import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadTestEnv } from "./test-env.js";

export const API_ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const PRISMA_BIN = fileURLToPath(new URL("../../node_modules/.bin/prisma", import.meta.url));

/** Drops every table, function and enum in the test database's public schema. */
const RESET_SQL = `
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.signature);
  END LOOP;
  FOR r IN SELECT t.typname FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = 'public' AND t.typtype = 'e' LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
  END LOOP;
END $$;`;

/** Runs the pinned Prisma CLI against the test database as the migrator role. */
export function runPrisma(args: string[], migratorUrl: string): string {
  return execFileSync(PRISMA_BIN, args, {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_MIGRATION_URL: migratorUrl },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Once per integration run: start from an empty test database and apply the committed
 * migrations with the real `prisma migrate deploy`, exactly as a deployment does. Every
 * run therefore tests the migration itself, and no data survives between runs.
 */
export default async function setup(): Promise<void> {
  const { migratorUrl } = loadTestEnv();
  const client = new pg.Client({ connectionString: migratorUrl });
  await client.connect();
  try {
    await client.query(RESET_SQL);
  } finally {
    await client.end();
  }
  runPrisma(["migrate", "deploy"], migratorUrl);
}
