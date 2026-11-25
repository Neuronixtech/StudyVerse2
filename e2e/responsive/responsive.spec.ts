import type { Page } from "@playwright/test";
import { expect, expectNoHorizontalOverflow, test } from "../support/fixtures";

const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 768, height: 1024 };
const MOBILE = { width: 390, height: 844 };
const SMALL_PHONE = { width: 360, height: 780 };

async function startDemo(page: Page) {
  await page.goto("/exam/t-demo");
  await page.getByRole("checkbox", { name: /I have read the instructions/ }).check();
  await page.getByRole("button", { name: /I am ready to begin/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Question 1" })).toBeVisible();
}

test.describe("Desktop", () => {
  test.use({ viewport: DESKTOP });

  test("RESP-001 — public pages keep their hierarchy without overflow", async ({ page }) => {
    for (const url of ["/", "/courses", "/courses/jee-physics-mechanics"]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
});

test.describe("Tablet", () => {
  test.use({ viewport: TABLET, session: { learner: "learnerActive" } });

  test("RESP-002 — learner dashboard, course detail and player adapt", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: /Rohan/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/courses/jee-physics-mechanics");
    await expect(page.getByRole("link", { name: /Continue learning/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/learn/jee-physics-mechanics/c-mechanics-m1-l2");
    await expect(page.getByRole("region", { name: /^Video player/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mark as complete|Completed/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Mobile", () => {
  test.use({ viewport: MOBILE, hasTouch: true, isMobile: true });

  test("RESP-003 — the menu opens, navigates and closes", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    for (const [label, url] of [
      ["Courses", "/courses"],
      ["Tests", "/tests"],
      ["Bookstore", "/books"],
    ] as const) {
      await page.getByRole("button", { name: "Open menu" }).tap();
      const menu = page.getByRole("dialog", { name: "Menu" });
      await menu.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: label }).tap();
      await expect(page).toHaveURL(url);
      await expect(menu).toBeHidden();
      await expectNoHorizontalOverflow(page);
    }
    await page.getByRole("button", { name: "Open menu" }).tap();
    await page.getByRole("button", { name: "Close panel" }).tap();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  });

  test("RESP-004 — course detail is readable and expandable", async ({ page }) => {
    await page.goto("/courses/jee-physics-mechanics");
    const content = page.getByRole("region", { name: "Course content" });
    await content.getByRole("button", { name: /Laws of Motion/ }).tap();
    await expect(content.getByRole("button", { name: /Friction/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("VID-009 — the player's controls are usable without overflow", async ({ page }) => {
    await page.goto("/learn/jee-physics-mechanics/c-mechanics-m1-l1");
    const player = page.getByRole("region", { name: /^Video player/ });
    await expect(player).toBeVisible();
    await page.getByRole("button", { name: "Play lesson" }).tap();
    await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
    const box = await player.getByRole("button", { name: "Forward 10 seconds" }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    await expectNoHorizontalOverflow(page);
  });

  test("RESP-005 / EXAM-030 — the exam is fully operable on a phone", async ({ page }) => {
    await startDemo(page);
    await expect(page.getByRole("timer")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Question palette" })).toBeHidden();

    await page.getByRole("radio").first().tap();
    await page.getByRole("button", { name: /Save & Next/ }).tap();
    await expect(page.getByRole("heading", { level: 1, name: "Question 2" })).toBeVisible();

    // palette opens as a drawer and does not stay over the answer area
    await page.getByRole("button", { name: "Open question palette" }).tap();
    const drawer = page.getByRole("dialog", { name: "Question palette" });
    await drawer.getByRole("button", { name: /^Question 1,/ }).tap();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Question 1" })).toBeVisible();

    await page.getByRole("tab", { name: /^Chemistry/ }).tap();
    await expect(page.getByRole("tab", { name: /^Chemistry/ })).toHaveAttribute("aria-selected", "true");
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /Submit test/ }).tap();
    const dialog = page.getByRole("dialog", { name: "Submit your test?" });
    await expect(dialog.getByRole("button", { name: /Submit test/ })).toBeInViewport();
    await dialog.getByRole("button", { name: /Submit test/ }).tap();
    await expect(page).toHaveURL(/\/results\/at-/);
  });

  test.describe("admin", () => {
    test.use({ session: { admin: "owner" } });

    test("RESP-006 — admin navigation and course list work on a phone", async ({ page }) => {
      await page.goto("/admin");
      await page.getByRole("button", { name: "Open admin navigation" }).tap();
      const drawer = page.getByRole("dialog", { name: "Admin console" });
      await drawer.getByRole("link", { name: /^Courses/ }).tap();
      await expect(page).toHaveURL("/admin/courses");
      await expect(page.getByRole("heading", { level: 1, name: "Courses" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
});

test("RESP-007 — the visitor header fits at tablet widths (regression: overflowed 145px at 768px)", async ({ page }) => {
  for (const width of [768, 820, 900, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test.describe("RESP-007 — no page-level horizontal overflow on core routes", () => {
  test.use({ session: { learner: "learnerActive", admin: "owner" } });

  for (const [name, viewport] of Object.entries({ desktop: DESKTOP, tablet: TABLET, mobile: MOBILE, "small phone": SMALL_PHONE })) {
    test(`${name} ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/books/calculus-workbook");
      await page.getByRole("button", { name: "Add to cart", exact: true }).click();

      const routes = [
        "/",
        "/courses/jee-physics-mechanics",
        "/learn/jee-physics-mechanics/c-mechanics-m1-l2",
        "/admin/courses",
        "/books/cart",
        "/books/checkout",
      ];
      for (const url of routes) {
        await page.goto(url);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
      await startDemo(page);
      await expectNoHorizontalOverflow(page);
    });
  }
});

/**
 * WCAG 2.1 AA 1.4.10 Reflow: content must work at 320 CSS px without page-level horizontal scrolling.
 * Wide data tables may scroll inside their own container; the page itself may not.
 */
const ALL_ROUTES = [
  "/", "/courses", "/courses/jee-physics-mechanics", "/learn/jee-physics-mechanics/c-mechanics-m1-l2", "/tests", "/tests/t-demo",
  "/exam/t-demo", "/subscribe", "/login", "/signup", "/forgot-password", "/reset-password", "/books", "/books/catalog",
  "/books/calculus-workbook", "/books/cart", "/books/checkout", "/books/orders/o-10241/payment", "/dashboard", "/dashboard/courses",
  "/dashboard/attempts", "/dashboard/subscription", "/dashboard/profile", "/dashboard/orders", "/dashboard/orders/o-10241",
  "/dashboard/addresses", "/results/at-001", "/results/at-001/review", "/admin/login", "/admin", "/admin/courses", "/admin/courses/c-mechanics",
  "/admin/tests", "/admin/tests/t-demo", "/admin/learners", "/admin/learners/l-rohan", "/admin/requests", "/admin/subscriptions",
  "/admin/staff", "/admin/settings", "/admin/bookstore", "/admin/bookstore/books", "/admin/bookstore/books/b-calculus-workbook",
  "/admin/bookstore/orders", "/admin/bookstore/orders/o-10238", "/admin/bookstore/dispatch", "/admin/bookstore/returns",
  "/admin/bookstore/reports", "/admin/bookstore/settings",
];

for (const [who, session] of [["visitor", {}], ["signed-in learner + owner", { learner: "learnerActive", admin: "owner" }]] as const) {
  test.describe(`RESP-007 — reflow at 320 px, ${who}`, () => {
    test.use({ session, viewport: { width: 320, height: 640 } });

    test(`RESP-007 — WCAG 1.4.10 reflow: no page-level horizontal scroll at 320 px on every route (${who})`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/books/calculus-workbook");
      await page.getByRole("button", { name: "Add to cart", exact: true }).click();
      for (const url of ALL_ROUTES) {
        await page.goto(url);
        await expect(page.getByRole("heading").first()).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
    });
  });
}

