import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readTestUrl(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `${key} is not set. Integration tests need a PostgreSQL test database (see apps/api/.env.example).`,
    );
  }
  const database = new URL(value).pathname.replace(/^\//, "");
  if (!database.endsWith("_test")) {
    throw new Error(
      `${key} must point at a database whose name ends in _test; refusing to run against "${database}".`,
    );
  }
  return value;
}

/**
 * Loads apps/api/.env for local runs (CI sets the variables directly; they take
 * precedence) and refuses to continue unless both test URLs point at a database whose
 * name ends in _test. Integration tests drop and recreate every object in it.
 */
export function loadTestEnv(): { appUrl: string; migratorUrl: string } {
  const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  return {
    appUrl: readTestUrl("TEST_DATABASE_URL"),
    migratorUrl: readTestUrl("TEST_DATABASE_MIGRATION_URL"),
  };
}
