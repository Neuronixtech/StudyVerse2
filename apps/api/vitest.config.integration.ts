import { defineConfig } from "vitest/config";

// Integration tests against a real PostgreSQL 18 test database. `npm run test:integration`.
// They share one database, so files run one at a time.
export default defineConfig({
  test: {
    include: ["test/**/*.int-spec.ts"],
    setupFiles: ["test/setup/integration-env.ts"],
    environment: "node",
    env: { TZ: "UTC" },
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
