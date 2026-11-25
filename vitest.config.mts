import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // JSON results feed scripts/traceability.mjs (reports/ is git-ignored)
    reporters: ["default", "json"],
    outputFile: { json: "reports/vitest.json" },
    // Dates are displayed in India Standard Time; pin the process zone so nothing depends on the host machine.
    env: { TZ: "Asia/Kolkata" },
    // Keep mocks from leaking between tests.
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
