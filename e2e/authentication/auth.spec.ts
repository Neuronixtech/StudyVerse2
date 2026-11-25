import { expect, readStore, test } from "../support/fixtures";

type Store = { session: { learnerId: string | null }; learners: { id: string; email: string }[] };

test.describe("Authentication UI (simulated)", () => {
  test("AUTH-001 — the login screen is reachable from navigation and fully labelled", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel(/^Password/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Log in/ })).toBeVisible();
  });

  test("AUTH-004 — fixture credentials sign in and land on the intended page", async ({ page }) => {
    await page.goto("/login?next=/dashboard/subscription");
    await page.getByLabel("Email address").fill("rohan@example.com");
    await page.getByLabel(/^Password/).fill("password1");
    await page.getByRole("button", { name: /^Log in/ }).click();

    await expect(page).toHaveURL("/dashboard/subscription");
    await expect(page.getByRole("heading", { level: 1, name: "Subscription" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: /Rohan/ })).toBeVisible();
    await expect(page.getByText("Simulated · prototype only").first()).toBeVisible();
  });

  test("AUTH-006 — signup creates a simulated account and signs in", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Ananya Sharma");
    await page.getByLabel(/^Email/).fill("ananya.e2e@example.com");
    await page.getByLabel("Mobile number").fill("9876543210");
    await page.getByLabel(/^Password/).fill("Str0ng!pass");
    await page.getByLabel("Confirm password").fill("Str0ng!pass");
    await page.getByRole("checkbox", { name: /I agree to the Terms/ }).check();
    await page.getByRole("button", { name: /Create account/ }).click();

    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: /Ananya/ })).toBeVisible();
    const store = await readStore<Store>(page);
    const created = store.learners.find((l) => l.email === "ananya.e2e@example.com");
    expect(store.session.learnerId).toBe(created?.id);
  });

  test.describe("signed in", () => {
    test.use({ session: { learner: "learnerActive" } });

    test("AUTH-008 — logout returns to the visitor experience", async ({ page }) => {
      await page.goto("/courses");
      await page.getByRole("banner").getByRole("button", { name: /Rohan/ }).click();
      await page.getByRole("menuitem", { name: /Log out/ }).click();

      await expect(page).toHaveURL("/");
      await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeVisible();
      await expect(page.getByRole("banner").getByRole("button", { name: /Rohan/ })).toHaveCount(0);
      expect((await readStore<Store>(page)).session.learnerId).toBeNull();
    });
  });

  test("AUTH-009 — a learner-only route asks a visitor to sign in", async ({ page }) => {
    await page.goto("/dashboard/attempts");
    await expect(page.getByRole("heading", { name: "Sign in to view your dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Attempt history" })).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL("/login?next=%2Fdashboard%2Fattempts");
  });

  test("AUTH-009 — the admin console asks for admin sign-in", async ({ page }) => {
    await page.goto("/admin/courses");
    await expect(page.getByRole("heading", { name: "Admin sign-in required" })).toBeVisible();
  });
});

test.describe("Password reset (simulated)", () => {
  test("AUTH (password reset) — forgot password leads to the simulated reset link and a new password", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL("/forgot-password");
    // Next 16 keeps the previous route (login) mounted but hidden, so match only visible fields
    await page.getByLabel("Email address").filter({ visible: true }).fill("rohan@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await expect(page.getByText("Prototype: no email is sent")).toBeVisible();

    await page.getByRole("link", { name: "Open reset link (simulated)" }).click();
    await expect(page).toHaveURL("/reset-password?email=rohan%40example.com");
    await page.getByLabel(/^New password/).fill("N3w-password!");
    await page.getByLabel("Confirm new password").fill("N3w-password!");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
  });
});
