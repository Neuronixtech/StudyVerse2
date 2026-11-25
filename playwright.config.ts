import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite (FRONTEND_TEST_PLAN.md §5, Milestone 3+).
 *
 * Runs against a production build (`next build && next start`), as the Next.js
 * docs recommend. Locally an already-running server on the same port is reused.
 *
 *   npm run test:e2e                     Chromium (every PR)
 *   E2E_ALL_BROWSERS=1 npm run test:e2e  + Firefox and WebKit (scheduled / pre-release)
 *   E2E_SKIP_BUILD=1 npm run test:e2e    reuse the existing .next build
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const allBrowsers = !!process.env.E2E_ALL_BROWSERS;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // A retry must never hide a failure: in CI a test that only passes on retry fails the run.
  failOnFlakyTests: isCI,
  workers: isCI ? 2 : undefined,
  // JSON results feed scripts/traceability.mjs (reports/ is git-ignored)
  reporter: [
    isCI ? ["github"] : ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: process.env.E2E_JSON_REPORT ?? "reports/playwright.json" }],
  ],
  timeout: 30_000,
  expect: { timeout: 7_500 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    ...(allBrowsers
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
          { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
        ]
      : []),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.E2E_SKIP_BUILD ? `npx next start --port ${PORT}` : `npm run build && npx next start --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 240_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
