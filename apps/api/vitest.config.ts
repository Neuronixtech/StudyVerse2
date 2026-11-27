import { defineConfig } from "vitest/config";

// Unit and HTTP tests: no database or network. `npm test`.
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
    env: { TZ: "UTC" },
    clearMocks: true,
    restoreMocks: true,
  },
});
