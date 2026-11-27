import { loadTestEnv } from "./test-env.js";

// Runs in every test worker: the same checks as global-setup.ts, and the URLs for tests.
const { appUrl, migratorUrl } = loadTestEnv();

export const TEST_DATABASE_URL = appUrl;
export const TEST_DATABASE_MIGRATION_URL = migratorUrl;
