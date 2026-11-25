import { test as base, expect, type Page } from "@playwright/test";
import { createSeed, STATE_VERSION } from "../../src/lib/mock/seed";
import { ADMINS, LEARNERS, type AdminFixture, type LearnerFixture } from "../../src/test/fixtures/users";

/** Same anchor as the unit/component suite: 20 Nov 2026, 10:00 IST. */
export const E2E_NOW = Date.UTC(2026, 10, 20, 4, 30);
export const STORAGE_KEY = "studyverse-prototype";

export interface Session {
  learner?: LearnerFixture | null;
  admin?: AdminFixture | null;
}

/** Errors that are expected in the prototype and safe to ignore. Keep this list short. */
const IGNORED_ERRORS: RegExp[] = [];

/**
 * WebKit only: when a test does a full `page.goto` while Next.js is still prefetching links,
 * the browser cancels those RSC requests and WebKit reports each as "…?_rsc=… due to access
 * control checks". Verified: zero errors while idle and on real client-side navigation in all
 * three engines; Firefox reports the same cancellations as NS_BINDING_ABORTED without an error.
 */
const WEBKIT_CANCELLED_PREFETCH = /[?&]_rsc=[\w-]+ due to access control checks\.?$/;

interface Fixtures {
  /** Who is signed in when the test starts. Override with `test.use({ session: { ... } })`. */
  session: Session;
  /** Uncaught page errors and console errors collected during the test. */
  pageErrors: string[];
  /** Console/page errors a specific test expects (e.g. the browser's 404 log on a not-found page). */
  allowedErrors: RegExp[];
}

/**
 * Every test gets:
 *  - a browser clock that starts at E2E_NOW and runs normally (`page.clock` can fast-forward it);
 *  - the seeded prototype data with the requested session, written to localStorage
 *    only if empty, so state changes survive navigation and reloads within the test;
 *  - a check that no uncaught error or console error occurred (plan §14).
 */
export const test = base.extend<Fixtures>({
  session: [{}, { option: true }],
  allowedErrors: [[], { option: true }],

  // The fixture callback is named `provide` (not Playwright's usual `use`) so the React hooks lint rule doesn't misfire.
  pageErrors: async ({}, provide) => {
    await provide([]);
  },

  page: async ({ page, session, pageErrors, allowedErrors, browserName }, provide) => {
    page.on("pageerror", (e) => pageErrors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(`console.error: ${msg.text()}`);
    });
    await page.clock.install({ time: E2E_NOW });
    const state = {
      ...createSeed(E2E_NOW),
      ready: false,
      session: {
        learnerId: session.learner ? LEARNERS[session.learner] : null,
        adminId: session.admin ? ADMINS[session.admin] : null,
      },
    };
    await page.addInitScript(
      ({ key, value }) => {
        if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
      },
      { key: STORAGE_KEY, value: JSON.stringify(state) },
    );

    await provide(page);

    const ignored = [...IGNORED_ERRORS, ...allowedErrors, ...(browserName === "webkit" ? [WEBKIT_CANCELLED_PREFETCH] : [])];
    const unexpected = pageErrors.filter((e) => !ignored.some((r) => r.test(e)));
    expect(unexpected, "uncaught page errors or console errors").toEqual([]);
  },
});

export { expect };

/** Reads the prototype store from this browser's localStorage. */
export async function readStore<T = Record<string, unknown>>(page: Page): Promise<T> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"), STORAGE_KEY);
}

/** Changes the signed-in session in place (e.g. switch from admin work to the learner view). */
export async function switchSession(page: Page, session: Session) {
  await page.evaluate(
    ({ key, learnerId, adminId }) => {
      const s = JSON.parse(window.localStorage.getItem(key)!);
      s.session = { learnerId, adminId };
      window.localStorage.setItem(key, JSON.stringify(s));
    },
    { key: STORAGE_KEY, learnerId: session.learner ? LEARNERS[session.learner] : null, adminId: session.admin ? ADMINS[session.admin] : null },
  );
}

/** Asserts the page has no page-level horizontal scroll. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page-level horizontal overflow in px").toBeLessThanOrEqual(0);
}

export { STATE_VERSION };
