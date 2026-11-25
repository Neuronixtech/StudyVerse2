import type { Page } from "@playwright/test";
import { expect, readStore, test } from "../support/fixtures";

type Store = { attempts: { id: string; testId: string; learnerId: string | null; autoSubmitted: boolean }[]; liveExams: Record<string, unknown> };

/** Acknowledges the instructions and starts the exam from /exam/<id>. */
async function begin(page: Page, testId: string) {
  await page.goto(`/exam/${testId}`);
  await page.getByRole("checkbox", { name: /I have read the instructions/ }).check();
  await page.getByRole("button", { name: /I am ready to begin/ }).click();
  await expect(page).toHaveURL(`/exam/${testId}/live`);
  await expect(page.getByRole("heading", { level: 1, name: "Question 1" })).toBeVisible();
}

const palette = (page: Page) => page.getByRole("complementary", { name: "Question palette" });

test.describe("Visitor — free demo", () => {
  test("EXAM-001 / EXAM-002 — a visitor opens and starts the demo without registering", async ({ page }) => {
    await page.goto("/tests");
    await page.getByRole("link", { name: /Start free demo/ }).click();
    await expect(page).toHaveURL("/exam/t-demo");
    await expect(page.getByRole("heading", { name: "General instructions" })).toBeVisible();

    // EXAM-005 — must acknowledge first. The button is aria-disabled (still focusable and clickable so it
    // can explain what's missing); Playwright treats aria-disabled as disabled, hence `force`.
    await expect(page.getByRole("button", { name: /I am ready to begin/ })).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: /I am ready to begin/ }).click({ force: true });
    await expect(page.getByText("Please confirm you have read the instructions to begin.")).toBeVisible();
    await expect(page).toHaveURL("/exam/t-demo");

    await page.getByRole("checkbox", { name: /I have read the instructions/ }).check();
    await page.getByRole("button", { name: /I am ready to begin/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Question 1" })).toBeVisible();
    await expect(page.getByText("Guest candidate").first()).toBeVisible();
  });

  test("EXAM-011 / EXAM-013 / EXAM-015 / EXAM-024 — answer, review, navigate, submit and see the result", async ({ page }) => {
    await begin(page, "t-demo");

    // Q1 single-correct: pick an option and Save & Next
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: /Save & Next/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Question 2" })).toBeVisible();

    // Q2: mark for review without answering
    await page.getByRole("button", { name: "Mark for Review & Next" }).click();
    await expect(palette(page).getByRole("button", { name: "Question 1, Answered" })).toBeVisible();
    await expect(palette(page).getByRole("button", { name: "Question 2, Marked for Review" })).toBeVisible();

    // palette back to Q1 keeps the answer
    await palette(page).getByRole("button", { name: /^Question 1,/ }).click();
    await expect(page.getByRole("radio").first()).toBeChecked();

    // EXAM-022 / EXAM-023 — open the summary, return, then submit
    await palette(page).getByRole("button", { name: /Submit test/ }).click();
    const dialog = page.getByRole("dialog", { name: "Submit your test?" });
    await expect(dialog.getByRole("row", { name: /^Total/ })).toContainText("9");
    await dialog.getByRole("button", { name: "Return to test" }).click();
    await expect(dialog).toBeHidden();

    await palette(page).getByRole("button", { name: /Submit test/ }).click();
    await dialog.getByRole("button", { name: /Submit test/ }).click();

    await expect(page).toHaveURL(/\/results\/at-/);
    await expect(page.getByText("Your score")).toBeVisible();
    await expect(page.getByText("Want to keep this result?")).toBeVisible();
    const store = await readStore<Store>(page);
    expect(store.attempts[0]).toMatchObject({ testId: "t-demo", learnerId: null, autoSubmitted: false });
    expect(store.liveExams).toEqual({});
  });

  test("EXAM-021 — the overall timer auto-submits when it reaches zero", async ({ page }) => {
    await begin(page, "t-demo");
    await expect(page.getByRole("timer")).toHaveAccessibleName(/Time left 00:(20:00|19:5\d)/);
    await page.clock.fastForward("20:05");
    await expect(page).toHaveURL(/\/results\/at-/);
    await expect(page.getByText("Auto-submitted when time ran out")).toBeVisible();
  });

  test("EXAM-028 — refreshing during an attempt keeps saved answers and the timer running", async ({ page }) => {
    await begin(page, "t-demo");
    await page.getByRole("radio").nth(1).check();
    await page.getByRole("button", { name: /Save & Next/ }).click();
    await page.clock.fastForward("02:00");

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Question 2" })).toBeVisible();
    await expect(palette(page).getByRole("button", { name: "Question 1, Answered" })).toBeVisible();
    await expect(page.getByRole("timer")).toHaveAccessibleName(/Time left 00:1[78]:/);
    // persistence is this browser's localStorage only — the instructions say so
    await page.goto("/exam/t-demo");
    await expect(page.getByText(/Your saved answers are kept and you can resume/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Resume test/ })).toBeVisible();
  });
});

test.describe("Active learner", () => {
  test.use({ session: { learner: "learnerActive" } });

  test("EXAM-004 / EXAM-018 — starts a regular multi-section test and switches sections", async ({ page }) => {
    await page.goto("/tests/t-main-01");
    await page.getByRole("link", { name: /Attempt again|Start test/ }).click();
    await expect(page.getByRole("definition").first()).toHaveText("60 minutes");
    await page.getByRole("checkbox", { name: /I have read the instructions/ }).check();
    await page.getByRole("button", { name: /I am ready to begin/ }).click();

    await expect(page.getByRole("tab", { name: /^Physics/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: /Save & Next/ }).click();
    await page.getByRole("tab", { name: /^Chemistry/ }).click();
    await expect(page.getByRole("tab", { name: /^Chemistry/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: /^Physics/ })).toContainText("1/12");
  });

  test("EXAM-020 / EXAM-021 — sectional timer locks an expired section and moves on", async ({ page }) => {
    await begin(page, "t-adv-sectional");
    await expect(page.getByText("Section left")).toBeVisible();
    await page.clock.fastForward("08:05");
    await expect(page.getByRole("tab", { name: /Physics/ })).toBeDisabled();
    await expect(page.getByRole("tab", { name: /^Chemistry/ })).toHaveAttribute("aria-selected", "true");
  });

  test("EXAM-026 — answer review is withheld until solutions are released", async ({ page }) => {
    const store = await (async () => {
      await page.goto("/dashboard/attempts");
      return readStore<Store>(page);
    })();
    const calculus = store.attempts.find((a) => a.testId === "t-calculus" && a.learnerId === "l-rohan")!;
    const demo = store.attempts.find((a) => a.testId === "t-demo" && a.learnerId === "l-rohan")!;

    await page.goto(`/results/${calculus.id}/review`);
    await expect(page.getByText("Solutions haven't been released yet")).toBeVisible();

    await page.goto(`/results/${demo.id}/review`);
    await expect(page.getByRole("heading", { name: "Answer review" })).toBeVisible();
    await expect(page.getByText("Correct answer").first()).toBeVisible();
    await expect(page.getByText("Explanation").first()).toBeVisible();
  });

  test("EXAM-027 — a new attempt appears first in attempt history", async ({ page }) => {
    await begin(page, "t-kinematics");
    await palette(page).getByRole("button", { name: /Submit test/ }).click();
    await page.getByRole("dialog", { name: "Submit your test?" }).getByRole("button", { name: /Submit test/ }).click();
    await expect(page).toHaveURL(/\/results\/at-/);

    await page.goto("/dashboard/attempts");
    const firstRow = page.getByRole("table").getByRole("row").nth(1);
    await expect(firstRow).toContainText("Physics: Kinematics Chapter Test");
    await expect(firstRow).toContainText("20 Nov 2026");
  });
});
