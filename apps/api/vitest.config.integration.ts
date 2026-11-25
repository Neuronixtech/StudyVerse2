import { defineConfig } from "vitest/config";

// Integration tests against a real PostgreSQL 18 test database. `npm run test:integration`.
// global-setup.ts empties the database and applies the committed migrations first.
// Tests share one database, so files run one at a time.
export default defineConfig({
  test: {
    include: ["test/**/*.int-spec.ts"],
    globalSetup: ["test/setup/global-setup.ts"],
    setupFiles: ["test/setup/integration-env.ts"],
    environment: "node",
    env: { TZ: "UTC" },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
