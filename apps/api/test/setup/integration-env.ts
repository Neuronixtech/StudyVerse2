import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Local runs read apps/api/.env; CI sets the variables directly (they take precedence).
const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Integration tests create and drop objects. Refuse to run against anything that isn't
// clearly a disposable test database.
for (const key of ["TEST_DATABASE_URL", "TEST_DATABASE_MIGRATION_URL"]) {
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
}

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL!;
export const TEST_DATABASE_MIGRATION_URL = process.env.TEST_DATABASE_MIGRATION_URL!;
