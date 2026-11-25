import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Colour contrast has its own exhaustive spec (contrast.spec.ts, A11Y-007), so it isn't repeated here. */
async function scan(page: Page, { include }: { include?: string } = {}) {
  let builder = new AxeBuilder({ page }).withTags(WCAG).disableRules(["color-contrast"]);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0].target.join(" ")}`);
}

const PUBLIC_PAGES = ["/", "/courses", "/courses/jee-physics-mechanics", "/tests", "/subscribe", "/books", "/books/catalog", "/login", "/signup"];

test.describe("Automated scans (axe-core)", () => {
  for (const url of PUBLIC_PAGES) {
    test(`A11Y-001 / A11Y-006 — no serious violations on ${url}`, async ({ page }) => {
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });
  }

  test.describe("signed in", () => {
    test.use({ session: { learner: "learnerActive", admin: "owner" } });

    for (const url of ["/dashboard", "/learn/jee-physics-mechanics/c-mechanics-m1-l2", "/books/cart", "/books/checkout", "/admin", "/admin/courses", "/admin/courses/new", "/exam/t-demo"]) {
      test(`A11Y-001 / A11Y-006 — no serious violations on ${url}`, async ({ page }) => {
        await page.goto(url);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        expect(await scan(page)).toEqual([]);
      });
    }

    test("A11Y-001 / A11Y-005 — the live exam, palette and submit dialog pass", async ({ page }) => {
      await page.goto("/exam/t-demo");
      await page.getByRole("checkbox", { name: /I have read the instructions/ }).check();
      await page.getByRole("button", { name: /I am ready to begin/ }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Question 1" })).toBeVisible();
      expect(await scan(page)).toEqual([]);

      await page.getByRole("complementary", { name: "Question palette" }).getByRole("button", { name: /Submit test/ }).click();
      await expect(page.getByRole("dialog", { name: "Submit your test?" })).toBeVisible();
      expect(await scan(page, { include: "dialog[open]" })).toEqual([]);
    });
  });

  test("A11Y-006 — every core page has one main landmark and a level-1 heading", async ({ page }) => {
    for (const url of ["/", "/courses/jee-physics-mechanics", "/tests/t-demo", "/books"]) {
      await page.goto(url);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeAttached();
    }
  });
});

test.describe("Keyboard", () => {
  test("A11Y-002 / A11Y-003 — skip link, primary navigation and visible focus", async ({ page, browserName }) => {
    // Safari/WebKit only moves focus to links with Option+Tab by default; that's what its users press.
    const TAB = browserName === "webkit" ? "Alt+Tab" : "Tab";
    await page.goto("/");
    await page.keyboard.press(TAB);
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    // focus indicator is drawn (outline from :focus-visible)
    await page.keyboard.press(TAB);
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);

    // reach the Courses link by keyboard and activate it
    const courses = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Courses" });
    for (let i = 0; i < 10 && !(await courses.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press(TAB);
    await expect(courses).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/courses");
  });

  test("A11Y-002 — the exam can be answered and navigated with the keyboard alone", async ({ page }) => {
    await page.goto("/exam/t-demo");
    await page.getByRole("checkbox", { name: /I have read the instructions/ }).focus();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: /I am ready to begin/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Question 1" })).toBeVisible();

    await page.getByRole("radio").first().focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio").first()).toBeChecked();
    await page.getByRole("button", { name: /Save & Next/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Question 2" })).toBeVisible();
  });

  test("A11Y-004 — dialog focus moves in, Escape closes, and focus returns to the trigger", async ({ page }) => {
    await page.goto("/exam/t-demo");
    await page.getByRole("checkbox", { name: /I have read the instructions/ }).check();
    await page.getByRole("button", { name: /I am ready to begin/ }).click();

    const trigger = page.getByRole("complementary", { name: "Question palette" }).getByRole("button", { name: /Submit test/ });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Submit your test?" });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);

    // Tab cycles within the modal (native <dialog> makes the rest of the page inert)
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate((d) => d.contains(document.activeElement) || document.activeElement === document.body);
      expect(inside).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("A11Y-004 — the mobile menu drawer closes with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  });
});

test.describe("Reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("A11Y-008 — non-essential animation is effectively disabled", async ({ page }) => {
    await page.goto("/books/catalog");
    await page.getByRole("button", { name: /^Add to cart\s*:\s*Calculus Workbook: 1000 Practice Problems$/ }).click();
    const toast = page.getByRole("status").filter({ hasText: "Added to cart" });
    await expect(toast).toBeVisible(); // feedback still appears
    const duration = await toast.evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
    expect(duration).toBeLessThan(0.01);
  });
});
