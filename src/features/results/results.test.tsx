import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getState } from "@/lib/store";
import type { Attempt, Test } from "@/lib/types";
import { makeAttempt, makeTest } from "@/test/fixtures/exams";
import { createTestState, type TestStateOptions } from "@/test/fixtures/state";
import { FIXED_NOW } from "@/test/fixtures/time";
import { LEARNERS } from "@/test/fixtures/users";
import { renderWithStore } from "@/test/render";
import { AnswerReview } from "./answer-review";
import { ResultView } from "./result-view";

// q1 correct (+4), q2 partial (+1), q3 wrong (−1), q4 unattempted → 4 / 16
const RESPONSES = { q1: { optionIds: ["q1-b"] }, q2: { optionIds: ["q2-a"] }, q3: { value: "99" } };

function seedAttempt(session: TestStateOptions, test: Test, attempt: Attempt) {
  return createTestState(session, (s) => {
    s.tests.push(test);
    s.attempts.push(attempt);
  });
}

beforeEach(() => vi.setSystemTime(FIXED_NOW));

describe("ResultView", () => {
  it("EXAM-025 — shows the score and outcome counts from the marking scheme", () => {
    const test = makeTest();
    renderWithStore(<ResultView attemptId="at-fixture" />, { state: seedAttempt({ learner: "learnerActive" }, test, makeAttempt(test, RESPONSES)) });

    expect(screen.getByRole("heading", { level: 1, name: "Fixture Mock Test" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Score 4 out of 16" })).toBeInTheDocument();
    expect(screen.getByText("25% of maximum marks")).toBeInTheDocument();

    const tile = (label: string) => screen.getByText(label, { selector: "p" }).previousElementSibling?.textContent;
    expect(tile("Correct")).toBe("1");
    expect(tile("Incorrect")).toBe("1");
    expect(tile("Partially correct")).toBe("1");
    expect(tile("Unattempted")).toBe("1");
  });

  it("labels an auto-submitted attempt", () => {
    const test = makeTest();
    renderWithStore(<ResultView attemptId="at-fixture" />, { state: seedAttempt({ learner: "learnerActive" }, test, makeAttempt(test, {}, { autoSubmitted: true })) });
    expect(screen.getByText("Auto-submitted when time ran out")).toBeInTheDocument();
  });

  it("ADMIN-011 — says which test version an older attempt was scored against", () => {
    const test = makeTest({ version: 1 });
    const attempt = makeAttempt(test, RESPONSES);
    renderWithStore(<ResultView attemptId="at-fixture" />, { state: seedAttempt({ learner: "learnerActive" }, { ...test, version: 2 }, attempt) });
    expect(screen.getByText(/Scored against version 1 of this test/)).toBeInTheDocument();
  });

  it("EXAM-026 — links to answer review only when solutions are released", () => {
    const released = makeTest();
    renderWithStore(<ResultView attemptId="at-fixture" />, { state: seedAttempt({ learner: "learnerActive" }, released, makeAttempt(released, RESPONSES)) });
    expect(screen.getByRole("link", { name: /Review answers/ })).toHaveAttribute("href", "/results/at-fixture/review");
  });

  it("EXAM-026 — withholds review while solutions are unreleased", () => {
    const withheld = makeTest({ resultRelease: "manual", solutionsReleased: false });
    renderWithStore(<ResultView attemptId="at-fixture" />, { state: seedAttempt({ learner: "learnerActive" }, withheld, makeAttempt(withheld, RESPONSES)) });
    expect(screen.getByText("Solutions not yet released")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Review answers/ })).not.toBeInTheDocument();
  });

  it("a guest demo result offers sign-up/log-in to keep it", () => {
    const test = makeTest({ isDemo: true });
    renderWithStore(<ResultView attemptId="at-fixture" />, { state: seedAttempt({}, test, makeAttempt(test, RESPONSES, { learnerId: null })) });
    expect(screen.getByText("Want to keep this result?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?claim=at-fixture&next=/results/at-fixture");
  });

  it("a signed-in learner can attach a guest demo result to their history", async () => {
    const test = makeTest({ isDemo: true });
    const { user } = renderWithStore(<ResultView attemptId="at-fixture" />, {
      state: seedAttempt({ learner: "learnerNoSubscription" }, test, makeAttempt(test, RESPONSES, { learnerId: null })),
    });
    await user.click(screen.getByRole("button", { name: "Save to my history" }));
    expect(getState().attempts.find((a) => a.id === "at-fixture")?.learnerId).toBe(LEARNERS.learnerNoSubscription);
  });

  it("another learner's result is not shown", () => {
    const test = makeTest();
    renderWithStore(<ResultView attemptId="at-fixture" />, { state: seedAttempt({ learner: "learnerNoSubscription" }, test, makeAttempt(test, RESPONSES)) });
    expect(screen.getByText("This result belongs to another account")).toBeInTheDocument();
    expect(screen.queryByText(/Your score/)).not.toBeInTheDocument();
  });

  it("STATE-006 — an unknown attempt shows a not-found state", () => {
    renderWithStore(<ResultView attemptId="missing" />, { session: { learner: "learnerActive" } });
    expect(screen.getByText("Result not found")).toBeInTheDocument();
  });
});

describe("AnswerReview", () => {
  it("EXAM-026 — shows each answer, the correct answer and the explanation once released", () => {
    const test = makeTest();
    renderWithStore(<AnswerReview attemptId="at-fixture" />, { state: seedAttempt({ learner: "learnerActive" }, test, makeAttempt(test, RESPONSES)) });

    expect(screen.getByRole("heading", { name: "Answer review" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").filter((li) => li.id.startsWith("q-"));
    expect(items).toHaveLength(4);

    const q3 = items[2];
    expect(within(q3).getByText("Your answer").nextElementSibling).toHaveTextContent("99");
    expect(within(q3).getByText("Correct answer").nextElementSibling).toHaveTextContent("12.5 (± 0.1)");
    expect(within(q3).getByText("Explanation for q3")).toBeInTheDocument();
  });

  it("filters by outcome", async () => {
    const test = makeTest();
    const { user } = renderWithStore(<AnswerReview attemptId="at-fixture" />, { state: seedAttempt({ learner: "learnerActive" }, test, makeAttempt(test, RESPONSES)) });
    await user.click(screen.getByRole("tab", { name: /^Partial/ }));
    const items = screen.getAllByRole("listitem").filter((li) => li.id.startsWith("q-"));
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Multi-select question q2");
  });

  it("EXAM-026 — keeps correct answers and explanations hidden while unreleased", () => {
    const withheld = makeTest({ resultRelease: "manual", solutionsReleased: false });
    renderWithStore(<AnswerReview attemptId="at-fixture" />, { state: seedAttempt({ learner: "learnerActive" }, withheld, makeAttempt(withheld, RESPONSES)) });
    expect(screen.getByText("Solutions haven't been released yet")).toBeInTheDocument();
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    expect(screen.queryByText("Explanation for q3")).not.toBeInTheDocument();
  });

  it("is not available for another learner's attempt", () => {
    const test = makeTest();
    renderWithStore(<AnswerReview attemptId="at-fixture" />, { state: seedAttempt({ learner: "learnerExpired" }, test, makeAttempt(test, RESPONSES)) });
    expect(screen.getByText("Review not available")).toBeInTheDocument();
  });
});
