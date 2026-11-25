import { expect, readStore, switchSession, test } from "../support/fixtures";

const COURSE = "/courses/jee-physics-mechanics";
const PREVIEW = "/learn/jee-physics-mechanics/c-mechanics-m1-l1";
const PAID = "/learn/jee-physics-mechanics/c-mechanics-m1-l2";

test.describe("Visitor", () => {
  test("COURSE-005 / VID-001 — a visitor can watch the free preview", async ({ page }) => {
    await page.goto(COURSE);
    await page.getByRole("link", { name: /Watch free preview/ }).first().click();
    await expect(page).toHaveURL(PREVIEW);
    await expect(page.getByRole("region", { name: /^Video player/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Welcome: how to use this course" })).toBeVisible();
  });
});

test.describe("No subscription", () => {
  test.use({ session: { learner: "learnerNoSubscription" } });

  test("SUB-008 — a paid lesson is locked with a subscription CTA", async ({ page }) => {
    await page.goto(COURSE);
    await page.getByRole("region", { name: "Course content" }).getByRole("button", { name: /SI units and dimensional analysis/ }).click();
    const dialog = page.getByRole("dialog", { name: "This lesson is locked" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: /View plans/ })).toBeVisible();
  });

  test("VID-007 — opening a paid lesson URL shows no playable controls", async ({ page }) => {
    await page.goto(PAID);
    await expect(page.getByText("This lesson is part of the subscription")).toBeVisible();
    await expect(page.getByRole("region", { name: /^Video player/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Play/ })).toHaveCount(0);
  });

  test("EXAM-003 — a regular test is locked", async ({ page }) => {
    await page.goto("/tests/t-main-01");
    await expect(page.getByText("Subscribe to unlock this test")).toBeVisible();
    await expect(page.getByRole("link", { name: /Start test/ })).toHaveCount(0);
  });

  test("SUB-003 — submitting an activation request leaves access locked", async ({ page }) => {
    await page.goto("/subscribe");
    await page.getByRole("radio", { name: /Monthly/ }).click();
    await page.getByLabel(/UPI transaction ID/).fill("402188761123");
    await page.getByRole("button", { name: "Submit activation request" }).click();
    await page.getByRole("dialog", { name: "Confirm your request" }).getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByRole("heading", { name: "Request submitted" })).toBeVisible();

    await page.goto("/dashboard/subscription");
    await expect(page.getByText("Activation pending")).toBeVisible();
    await page.goto(PAID);
    await expect(page.getByText("Activation request pending")).toBeVisible();
    await expect(page.getByRole("region", { name: /^Video player/ })).toHaveCount(0);
  });
});

test.describe("Active subscription", () => {
  test.use({ session: { learner: "learnerActive" } });

  test("SUB-009 / VID-005 — a full lesson plays and can be marked complete", async ({ page }) => {
    await page.goto("/learn/calculus-for-jee/c-calculus-m1-l2");
    await expect(page.getByRole("region", { name: /^Video player/ })).toBeVisible();
    await page.getByRole("button", { name: /Mark as complete/ }).click();
    await expect(page.getByRole("button", { name: "Completed", exact: true })).toHaveAttribute("aria-pressed", "true");

    // VID-006 — reopening keeps it complete
    await page.reload();
    await expect(page.getByRole("button", { name: "Completed", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("VID-003 — resumes an in-progress lesson from the saved position", async ({ page }) => {
    // seed: Rohan stopped at 452s (7:32) in Mechanics m2-l2
    await page.goto("/learn/jee-physics-mechanics/c-mechanics-m2-l2");
    await expect(page.getByText("Pick up where you left off?")).toBeVisible();
    await page.getByRole("button", { name: "Resume from 7:32" }).click();
    await expect(page.getByText(/^7:3\d \/ 19:05$/)).toBeVisible();
  });

  test("COURSE-006 — Next lesson navigates through the course", async ({ page }) => {
    await page.goto("/learn/jee-physics-mechanics/c-mechanics-m1-l3");
    await page.getByRole("button", { name: /^Next:\s*Motion in a straight line/ }).click();
    await expect(page).toHaveURL("/learn/jee-physics-mechanics/c-mechanics-m2-l1");
    await expect(page.getByText("Kinematics · Lesson 4 of 13")).toBeVisible();
  });
});

test.describe("Expired subscription", () => {
  test.use({ session: { learner: "learnerExpired" } });

  test("SUB-010 — paid lessons lock but progress and attempt history remain", async ({ page }) => {
    await page.goto("/learn/mht-cet-pcm-revision/c-mhtcet-m1-l2");
    await expect(page.getByText(/Your subscription expired on/)).toBeVisible();
    await expect(page.getByRole("region", { name: /^Video player/ })).toHaveCount(0);

    await page.goto("/dashboard/attempts");
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(3); // header + 2 attempts
    await page.goto("/dashboard/courses");
    await expect(page.getByText(/MHT-CET/).first()).toBeVisible();
  });
});

test.describe("Admin approval → learner access", () => {
  test.use({ session: { learner: "learnerPending", admin: "owner" } });

  test("SUB-005 — approving a pending request unlocks paid content for the learner", async ({ page }) => {
    await page.goto(PAID);
    await expect(page.getByText("Activation request pending")).toBeVisible();

    await page.goto("/admin/requests");
    await page.getByRole("row", { name: /Diya Sharma/ }).getByRole("button", { name: /Review/ }).click();
    const dialog = page.getByRole("dialog", { name: "Review activation request" });
    await dialog.getByRole("button", { name: /^Approve/ }).click();
    await dialog.getByRole("button", { name: /Confirm approval/ }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/dashboard/subscription");
    await expect(page.getByText("90 days left")).toBeVisible();
    await page.goto(PAID);
    await expect(page.getByRole("region", { name: /^Video player/ })).toBeVisible();
  });

  test("SUB-006 / SUB-007 — a rejection shows its reason and the learner can resubmit", async ({ page }) => {
    await page.goto("/admin/requests");
    await page.getByRole("row", { name: /Diya Sharma/ }).getByRole("button", { name: /Review/ }).click();
    const dialog = page.getByRole("dialog", { name: "Review activation request" });
    await dialog.getByRole("button", { name: /^Reject/ }).click();
    await dialog.getByLabel(/Reason shown to the learner/).fill("UTR not found in our statement — please recheck.");
    await dialog.getByRole("button", { name: /Confirm rejection/ }).click();

    await switchSession(page, { learner: "learnerPending" });
    await page.goto("/dashboard/subscription");
    await expect(page.getByText(/UTR not found in our statement/).first()).toBeVisible();
    await page.goto(PAID);
    await expect(page.getByRole("region", { name: /^Video player/ })).toHaveCount(0);

    await page.goto("/subscribe");
    await expect(page.getByText("Your previous request was rejected")).toBeVisible();
    await page.getByLabel(/UPI transaction ID/).fill("509912340087");
    await page.getByRole("button", { name: "Submit activation request" }).click();
    await page.getByRole("dialog", { name: "Confirm your request" }).getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByRole("heading", { name: "Request submitted" })).toBeVisible();

    const store = await readStore<{ requests: { learnerId: string; status: string }[] }>(page);
    expect(store.requests.filter((r) => r.learnerId === "l-diya").map((r) => r.status).sort()).toEqual(["pending", "rejected"]);
  });
});

test.describe("Player media errors", () => {
  test.use({ session: { learner: "learnerActive" } });

  test("VID-008 — a failed video load shows an error with Try again, and recovers", async ({ page }) => {
    await page.goto("/learn/jee-physics-mechanics/c-mechanics-m1-l2");
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("studyverse-prototype")!);
      s.prefs.simulateError = true;
      localStorage.setItem("studyverse-prototype", JSON.stringify(s));
    });
    await page.reload();
    const alert = page.getByRole("alert").filter({ hasText: "This video couldn't load" });
    await expect(alert).toBeVisible();
    await expect(page.getByRole("region", { name: /^Video player/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to course page" })).toBeVisible();

    await alert.getByRole("button", { name: /Try again/ }).click();
    await expect(page.getByRole("region", { name: /^Video player/ })).toBeVisible();
  });
});
