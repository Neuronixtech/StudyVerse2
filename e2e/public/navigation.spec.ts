import { expect, test } from "../support/fixtures";

test.describe("Public website and navigation", () => {
  test("PUB-001 — homepage loads for a visitor", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeVisible();
    await page.mouse.wheel(0, 4000);
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("PUB-002 — main navigation, active state and browser history", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });

    await nav.getByRole("link", { name: "Courses" }).click();
    await expect(page).toHaveURL("/courses");
    await expect(nav.getByRole("link", { name: "Courses" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Tests" }).click();
    await expect(page).toHaveURL("/tests");
    await expect(nav.getByRole("link", { name: "Tests" })).toHaveAttribute("aria-current", "page");

    await page.goBack();
    await expect(page).toHaveURL("/courses");
    await page.goForward();
    await expect(page).toHaveURL("/tests");

    await nav.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL("/");
  });

  test("PUB-003 — the course catalog is public and lists only published courses", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByText("Showing 8 courses")).toBeVisible();
    await expect(page.getByRole("heading", { name: "JEE Physics: Mechanics Masterclass" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Modern Physics for JEE Advanced" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "JEE Main 2025 Last-Mile Revision" })).toHaveCount(0);
  });

  test("PUB-004 / PUB-005 — a course card opens the matching detail page, viewable without sign-in", async ({ page }) => {
    await page.goto("/courses");
    await page.getByRole("link", { name: /JEE Physics: Mechanics Masterclass/ }).first().click();
    await expect(page).toHaveURL("/courses/jee-physics-mechanics");
    await expect(page.getByRole("heading", { level: 1, name: "JEE Physics: Mechanics Masterclass" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Course content" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Course content" }).getByRole("button", { name: /Welcome: how to use this course/ })).toBeVisible();
    await expect(page.getByText("Sign in to unlock all lessons")).toBeVisible();
  });

  test("PUB-006 — an archived course's direct link is not presented as published", async ({ page }) => {
    await page.goto("/courses/jee-main-2025-revision");
    await expect(page.getByText("This course has been archived")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Course content" })).toHaveCount(0);
  });

  test.describe(() => {
    // The browser itself logs the 404 document response as a console error.
    test.use({ allowedErrors: [/status of 404/] });

    test("PUB-007 — an unknown route shows a useful not-found page", async ({ page }) => {
      const res = await page.goto("/this-page-does-not-exist");
      expect(res?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "This page isn't on the syllabus" })).toBeVisible();
      await page.getByRole("link", { name: "Go home" }).click();
      await expect(page).toHaveURL("/");
    });
  });

  test("PUB-008 — a deep link renders directly and survives refresh", async ({ page }) => {
    await page.goto("/courses/organic-chemistry-mechanisms");
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toBeVisible();
    const text = await title.textContent();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(text!);
  });

  test("EXAM-001 — the free demo test is visible to a visitor", async ({ page }) => {
    await page.goto("/tests");
    await expect(page.getByRole("link", { name: /Start free demo/ })).toBeVisible();
  });
});
