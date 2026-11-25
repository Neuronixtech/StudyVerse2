import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test, type Session } from "../support/fixtures";

/**
 * A11Y-007 — WCAG 2.1 AA text contrast (1.4.3) on every route and on the interactive
 * states that only appear after user action (dialogs, menus, toasts, the live exam),
 * in both the light and the dark theme. The app follows the OS theme, so the theme
 * is selected with Playwright's `colorScheme`.
 */

async function contrastViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  return violations.flatMap((v) =>
    v.nodes.map((n) => {
      const d = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string };
      return `${n.target.join(" ")} — ${d.fgColor} on ${d.bgColor} = ${d.contrastRatio} (needs ${d.expectedContrastRatio})`;
    }),
  );
}

async function settle(page: Page) {
  await expect(page.getByRole("heading").first()).toBeVisible();
  // let entrance animations finish so axe reads final colours
  await page.waitForTimeout(400);
}

const MEMBER: Session = { learner: "learnerActive", admin: "owner" };

const ROUTES: { session: Session; label: string; urls: string[] }[] = [
  { session: {}, label: "visitor", urls: ["/", "/courses", "/courses/jee-physics-mechanics", "/tests", "/tests/t-demo", "/subscribe", "/login", "/signup", "/forgot-password", "/reset-password", "/books", "/books/catalog", "/books/calculus-workbook", "/books/cart", "/admin/login", "/learn/jee-physics-mechanics/c-mechanics-m1-l1"] },
  { session: { learner: "learnerNoSubscription" }, label: "no subscription", urls: ["/learn/jee-physics-mechanics/c-mechanics-m1-l2", "/tests/t-main-01", "/dashboard"] },
  {
    session: MEMBER,
    label: "learner + owner",
    urls: [
      "/learn/jee-physics-mechanics/c-mechanics-m1-l2",
      "/books/checkout",
      "/books/orders/o-10241/payment",
      "/dashboard",
      "/dashboard/courses",
      "/dashboard/attempts",
      "/dashboard/subscription",
      "/dashboard/profile",
      "/dashboard/orders",
      "/dashboard/orders/o-10241",
      "/dashboard/addresses",
      "/results/at-004",
      "/results/at-004/review",
      "/results/at-001",
      "/results/at-001/review", // demo attempt: has correct, incorrect, partial and unattempted chips
      "/exam/t-demo",
      "/admin",
      "/admin/courses",
      "/admin/courses/c-mechanics",
      "/admin/tests",
      "/admin/tests/t-demo",
      "/admin/learners",
      "/admin/learners/l-rohan",
      "/admin/requests",
      "/admin/subscriptions",
      "/admin/staff",
      "/admin/settings",
      "/admin/bookstore",
      "/admin/bookstore/books",
      "/admin/bookstore/books/b-calculus-workbook",
      "/admin/bookstore/orders",
      "/admin/bookstore/orders/o-10238",
      "/admin/bookstore/dispatch",
      "/admin/bookstore/returns",
      "/admin/bookstore/reports",
      "/admin/bookstore/settings",
    ],
  },
];

async function startDemo(page: Page) {
  await page.goto("/exam/t-demo");
  await page.getByRole("checkbox", { name: /I have read the instructions/ }).check();
  await page.getByRole("button", { name: /I am ready to begin/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Question 1" })).toBeVisible();
}

/** States that only exist after interaction. Each leaves the page in the state to scan. */
const STATES: { name: string; session: Session; viewport?: { width: number; height: number }; run: (page: Page) => Promise<void> }[] = [
  {
    name: "live exam with every palette state",
    session: MEMBER,
    run: async (page) => {
      await startDemo(page);
      await page.getByRole("radio").first().check();
      await page.getByRole("button", { name: /Save & Next/ }).click(); // answered
      await page.getByRole("button", { name: "Mark for Review & Next" }).click(); // review
      await page.getByRole("button", { name: /Save & Next/ }).click(); // not answered (numerical left blank)
      await page.getByRole("radio").first().check();
      await page.getByRole("button", { name: "Mark for Review & Next" }).click(); // answered + review
    },
  },
  {
    name: "exam submit dialog",
    session: MEMBER,
    run: async (page) => {
      await startDemo(page);
      await page.getByRole("complementary", { name: "Question palette" }).getByRole("button", { name: /Submit test/ }).click();
      await expect(page.getByRole("dialog", { name: "Submit your test?" })).toBeVisible();
    },
  },
  {
    name: "exam on a phone with the palette drawer open",
    session: MEMBER,
    viewport: { width: 390, height: 844 },
    run: async (page) => {
      await startDemo(page);
      await page.getByRole("button", { name: "Open question palette" }).click();
      await expect(page.getByRole("dialog", { name: "Question palette" })).toBeVisible();
    },
  },
  {
    name: "numerical question with a validation error",
    session: MEMBER,
    run: async (page) => {
      await startDemo(page);
      await page.getByRole("complementary", { name: "Question palette" }).getByRole("button", { name: /^Question 3,/ }).click();
      await page.getByLabel("Your answer").fill("1.2.3");
      await page.getByRole("button", { name: /Save & Next/ }).click();
      await expect(page.getByText("Enter a valid number")).toBeVisible();
    },
  },
  {
    name: "locked lesson dialog",
    session: { learner: "learnerNoSubscription" },
    run: async (page) => {
      await page.goto("/courses/jee-physics-mechanics");
      await page.getByRole("region", { name: "Course content" }).getByRole("button", { name: /SI units/ }).click();
      await expect(page.getByRole("dialog", { name: "This lesson is locked" })).toBeVisible();
    },
  },
  {
    name: "account and notification menus",
    session: MEMBER,
    run: async (page) => {
      await page.goto("/courses");
      await page.getByRole("banner").getByRole("button", { name: /Rohan/ }).click();
      await expect(page.getByRole("menuitem", { name: /Log out/ })).toBeVisible();
    },
  },
  {
    name: "toast and prototype controls",
    session: {},
    run: async (page) => {
      await page.goto("/books/catalog");
      await page.getByRole("button", { name: /^Add to cart\s*:\s*Calculus Workbook/ }).click();
      await expect(page.getByRole("status").filter({ hasText: "Added to cart" })).toBeVisible();
      await page.getByRole("button", { name: /^Prototype controls/ }).click();
      await expect(page.getByRole("dialog", { name: "Prototype controls" })).toBeVisible();
    },
  },
  {
    name: "form validation errors",
    session: {},
    run: async (page) => {
      await page.goto("/signup");
      await page.getByRole("button", { name: /Create account/ }).click();
      await expect(page.getByText("Enter your full name")).toBeVisible();
    },
  },
  {
    name: "admin request review dialog",
    session: MEMBER,
    run: async (page) => {
      await page.goto("/admin/requests");
      await page.getByRole("row", { name: /Diya Sharma/ }).getByRole("button", { name: /Review/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: /^Reject/ }).click();
      await expect(page.getByLabel(/Reason shown to the learner/)).toBeVisible();
    },
  },
  {
    name: "admin course curriculum and lesson dialog",
    session: MEMBER,
    run: async (page) => {
      await page.goto("/admin/courses/c-mechanics");
      await page.getByRole("tab", { name: /Curriculum/ }).click();
      await page.getByRole("button", { name: "Edit lesson" }).first().click();
      await expect(page.getByRole("dialog", { name: "Edit lesson" })).toBeVisible();
    },
  },
  {
    name: "admin question editor",
    session: MEMBER,
    run: async (page) => {
      await page.goto("/admin/tests/t-main-02");
      await page.getByRole("tab", { name: /Sections & questions/ }).click();
      await page.getByRole("button", { name: /Add question/ }).first().click();
      await expect(page.getByRole("dialog", { name: "Add question" })).toBeVisible();
    },
  },
  {
    name: "admin stock adjustment dialog",
    session: MEMBER,
    run: async (page) => {
      await page.goto("/admin/bookstore/books/b-calculus-workbook");
      await page.getByRole("tab", { name: /^Inventory/ }).click();
      await page.getByRole("button", { name: /Adjust stock/ }).click();
      await expect(page.getByRole("dialog", { name: "Adjust stock" })).toBeVisible();
    },
  },
  {
    name: "admin console on a phone with navigation open",
    session: MEMBER,
    viewport: { width: 390, height: 844 },
    run: async (page) => {
      await page.goto("/admin");
      await page.getByRole("button", { name: "Open admin navigation" }).click();
      await expect(page.getByRole("dialog", { name: "Admin console" })).toBeVisible();
    },
  },
  {
    name: "catalog error state",
    session: {},
    run: async (page) => {
      await page.goto("/courses");
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("studyverse-prototype")!);
        s.prefs.simulateError = true;
        localStorage.setItem("studyverse-prototype", JSON.stringify(s));
      });
      await page.reload();
      await expect(page.getByRole("alert").filter({ hasText: "Couldn't load courses" })).toBeVisible();
    },
  },
];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`A11Y-007 — colour contrast, ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const group of ROUTES) {
      test.describe(group.label, () => {
        test.use({ session: group.session });
        for (const url of group.urls) {
          test(`A11Y-007 — ${colorScheme} — ${group.label} — ${url}`, async ({ page }) => {
            await page.goto(url);
            await settle(page);
            expect(await contrastViolations(page)).toEqual([]);
          });
        }
      });
    }

    for (const state of STATES) {
      test.describe(state.name, () => {
        test.use({ session: state.session, ...(state.viewport ? { viewport: state.viewport } : {}) });
        test(`A11Y-007 — ${colorScheme} — ${state.name}`, async ({ page }) => {
          await state.run(page);
          await page.waitForTimeout(400);
          expect(await contrastViolations(page)).toEqual([]);
        });
      });
    }
  });
}
