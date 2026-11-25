import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getState, liveKey } from "@/lib/store";
import { makeSectionalTest, makeTest } from "@/test/fixtures/exams";
import { createTestState, type TestStateOptions } from "@/test/fixtures/state";
import { FIXED_NOW } from "@/test/fixtures/time";
import { LEARNERS } from "@/test/fixtures/users";
import { router } from "@/test/mocks/next-navigation";
import { renderWithStore } from "@/test/render";
import { ExamInstructions } from "./exam-instructions";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const ACK = /I have read the instructions/;

function renderInstructions(testId: string, session: TestStateOptions = {}, extra = makeTest()) {
  const state = createTestState(session, (s) => s.tests.push(extra));
  return renderWithStore(<ExamInstructions testId={testId} />, { state });
}

beforeEach(() => {
  vi.setSystemTime(FIXED_NOW);
});

describe("ExamInstructions", () => {
  it("EXAM-004 — shows duration, sections, question count and marking scheme", () => {
    renderInstructions("t-fixture", { learner: "learnerActive" });

    expect(screen.getByRole("heading", { name: "General instructions" })).toBeInTheDocument();
    expect(screen.getByText("Fixture Mock Test")).toBeInTheDocument();
    const facts = screen.getAllByRole("definition").map((d) => d.textContent);
    expect(facts).toEqual(["30 minutes", "One overall timer", "4", "16"]);

    const sections = within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(sections).toEqual(["Physics2Single correct, Multi-select", "Mathematics2Numerical, Single correct"]);
    expect(screen.getByText("This test has negative marking.")).toBeInTheDocument();
  });

  it("explains per-section timing for a sectional test", () => {
    renderInstructions("t-sectional-fixture", { learner: "learnerActive" }, makeSectionalTest());
    expect(screen.getByText("Per-section timers")).toBeInTheDocument();
    expect(screen.getByText(/that section is locked and cannot be revisited/)).toBeInTheDocument();
  });

  it("EXAM-005 — starting is blocked until the instructions are acknowledged", async () => {
    const { user } = renderInstructions("t-fixture", { learner: "learnerActive" });
    const start = screen.getByRole("button", { name: /I am ready to begin/ });

    await user.click(start);
    expect(screen.getByText("Please confirm you have read the instructions to begin.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: ACK })).toHaveAttribute("aria-invalid", "true");
    expect(router.push).not.toHaveBeenCalled();
    expect(getState().liveExams).toEqual({});

    await user.click(screen.getByRole("checkbox", { name: ACK }));
    await user.click(start);
    expect(router.push).toHaveBeenCalledWith("/exam/t-fixture/live");
    expect(getState().liveExams[liveKey(LEARNERS.learnerActive, "t-fixture")]).toBeDefined();
  });

  it("EXAM-002 — a visitor can start the free demo without an account", async () => {
    const { user } = renderInstructions("t-demo");
    expect(screen.getByText(/You're attempting as a guest/)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: ACK }));
    await user.click(screen.getByRole("button", { name: /I am ready to begin/ }));

    expect(router.push).toHaveBeenCalledWith("/exam/t-demo/live");
    expect(getState().liveExams[liveKey(null, "t-demo")]).toMatchObject({ learnerId: null });
  });

  it("EXAM-003 — a learner without a subscription sees the unlock prompt instead of Start", () => {
    renderInstructions("t-fixture", { learner: "learnerNoSubscription" });
    expect(screen.queryByRole("button", { name: /I am ready to begin/ })).not.toBeInTheDocument();
    expect(screen.getByText("Subscribe to unlock this test")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View plans/ })).toHaveAttribute("href", "/subscribe");
  });

  it("AUTH-009 — a visitor is asked to sign in for a regular test", () => {
    renderInstructions("t-fixture");
    expect(screen.getByText("Sign in to unlock this test")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", `/login?next=${encodeURIComponent("/exam/t-fixture")}`);
  });

  it("offers Resume when an attempt is already in progress", () => {
    const test = makeTest();
    const state = createTestState({ learner: "learnerActive" }, (s) => {
      s.tests.push(test);
      s.liveExams[liveKey(LEARNERS.learnerActive, test.id)] = {
        key: liveKey(LEARNERS.learnerActive, test.id),
        testId: test.id,
        learnerId: LEARNERS.learnerActive,
        startedAt: FIXED_NOW,
        snapshot: { testId: test.id, version: 1, title: test.title, timingMode: "overall", durationMin: 30, defaultMarks: test.defaultMarks, multiMarking: "partial", sections: test.sections },
        responses: {},
        visited: ["q1"],
        marked: [],
        currentSectionId: "s-phy",
        currentQuestionId: "q1",
        sectionElapsed: {},
        sectionActiveSince: FIXED_NOW,
        lockedSectionIds: [],
      };
    });
    renderWithStore(<ExamInstructions testId={test.id} />, { state });
    expect(screen.getByRole("button", { name: /Resume test/ })).toBeInTheDocument();
  });

  it("blocks a new attempt once the attempt limit is used up", () => {
    // t-calculus allows 3 attempts; the active learner has 1 seeded attempt — add two more.
    const state = createTestState({ learner: "learnerActive" }, (s) => {
      const seeded = s.attempts.find((a) => a.testId === "t-calculus" && a.learnerId === LEARNERS.learnerActive)!;
      s.attempts.push({ ...seeded, id: "at-extra-1" }, { ...seeded, id: "at-extra-2" });
    });
    renderWithStore(<ExamInstructions testId="t-calculus" />, { state });

    expect(screen.getByText("Attempt limit reached")).toBeInTheDocument();
    expect(screen.getByText(/You've used all 3 attempts/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /I am ready to begin/ })).not.toBeInTheDocument();
  });

  it("allows another attempt while under the limit", () => {
    renderInstructions("t-calculus", { learner: "learnerActive" });
    expect(screen.getByRole("button", { name: /I am ready to begin/ })).toBeInTheDocument();
  });

  it("STATE-006 — an unknown or unpublished test shows an unavailable state", () => {
    renderInstructions("t-main-02", { learner: "learnerActive" });
    expect(screen.getByText("Test not available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to tests" })).toHaveAttribute("href", "/tests");
  });
});
