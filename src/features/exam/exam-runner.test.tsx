import { act, cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getState, liveKey, startLiveExam } from "@/lib/store";
import type { Test } from "@/lib/types";
import { makeSectionalTest, makeTest } from "@/test/fixtures/exams";
import { createTestState } from "@/test/fixtures/state";
import { FIXED_NOW, MINUTE, SECOND } from "@/test/fixtures/time";
import { LEARNERS } from "@/test/fixtures/users";
import { router } from "@/test/mocks/next-navigation";
import { advance, renderWithStore } from "@/test/render";
import { ExamRunner } from "./exam-runner";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const LEARNER = LEARNERS.learnerActive;

/** Seeds the store with `test`, starts a live attempt for the active learner and renders the runner. */
function startExam(test: Test = makeTest()) {
  const state = createTestState({ learner: "learnerActive" }, (s) => s.tests.push(test));
  const utils = renderWithStore(<ExamRunner testId={test.id} />, { state });
  act(() => {
    startLiveExam(test, LEARNER);
  });
  return utils;
}

const live = (testId = "t-fixture") => getState().liveExams[liveKey(LEARNER, testId)];
const heading = () => screen.getByRole("heading", { level: 1 });
const palette = () => screen.getByRole("complementary", { name: "Question palette" });
const paletteButton = (n: number) => within(palette()).getByRole("button", { name: new RegExp(`^Question ${n},`) });
const option = (text: RegExp) => screen.getByRole("radio", { name: text });
const timer = () => screen.getByRole("timer");
const click = {
  saveNext: () => screen.getByRole("button", { name: /Save & Next/ }),
  markNext: () => screen.getByRole("button", { name: "Mark for Review & Next" }),
  clear: () => screen.getByRole("button", { name: /Clear Response/ }),
  back: () => screen.getByRole("button", { name: /^Back$/ }),
  submit: () => within(palette()).getByRole("button", { name: /Submit test/ }),
};

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW });
});

afterEach(async () => {
  // Unmount, then let pending toast timers fire so no toast leaks into the next test.
  cleanup();
  await vi.advanceTimersByTimeAsync(5 * SECOND);
});

describe("ExamRunner — answering", () => {
  it("EXAM-006 — selects exactly one option and saves it as Answered", async () => {
    const { user } = startExam();
    expect(heading()).toHaveTextContent("Question 1");

    await user.click(option(/Option B for q1/));
    expect(option(/Option B for q1/)).toBeChecked();
    expect(screen.getByText(/Unsaved selection/)).toBeInTheDocument();

    await user.click(click.saveNext());
    expect(live().responses.q1).toEqual({ optionIds: ["q1-b"] });
    expect(paletteButton(1)).toHaveAccessibleName("Question 1, Answered");
  });

  it("EXAM-007 — changing a single-correct answer replaces the previous option", async () => {
    const { user } = startExam();
    await user.click(option(/Option A for q1/));
    await user.click(option(/Option C for q1/));
    expect(option(/Option A for q1/)).not.toBeChecked();
    expect(option(/Option C for q1/)).toBeChecked();
    expect(screen.getAllByRole("radio").filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
  });

  it("EXAM-008 — multi-select keeps several options and removes a deselected one", async () => {
    const { user } = startExam();
    await user.click(click.saveNext()); // to q2 (multi)
    expect(screen.getByText("Select one or more correct options")).toBeInTheDocument();

    const box = (l: string) => screen.getByRole("checkbox", { name: new RegExp(`Option ${l} for q2`) });
    await user.click(box("A"));
    await user.click(box("B"));
    await user.click(box("C"));
    await user.click(box("B"));
    expect(box("A")).toBeChecked();
    expect(box("B")).not.toBeChecked();
    expect(box("C")).toBeChecked();

    await user.click(click.saveNext());
    expect(live().responses.q2).toEqual({ optionIds: ["q2-a", "q2-c"] });
  });

  it("EXAM-009 — a numerical answer is retained after navigating away and back", async () => {
    const { user } = startExam();
    await user.click(screen.getByRole("tab", { name: /^Mathematics/ }));
    const input = screen.getByLabelText("Your answer");
    await user.type(input, "12.5");
    await user.click(click.saveNext());
    expect(heading()).toHaveTextContent("Question 2");

    await user.click(click.back());
    expect(screen.getByLabelText("Your answer")).toHaveValue("12.5");
    expect(live().responses.q3).toEqual({ value: "12.5" });
  });

  it("EXAM-009 — the on-screen keypad enters digits too", async () => {
    const { user } = startExam();
    await user.click(screen.getByRole("tab", { name: /^Mathematics/ }));
    const keypad = screen.getByRole("group", { name: "Numeric keypad" });
    await user.click(within(keypad).getByRole("button", { name: "1" }));
    await user.click(within(keypad).getByRole("button", { name: "Decimal point" }));
    await user.click(within(keypad).getByRole("button", { name: "5" }));
    expect(screen.getByLabelText("Your answer")).toHaveValue("1.5");
    // negatives are disabled for this question
    expect(within(keypad).getByRole("button", { name: "Toggle minus sign" })).toBeDisabled();
  });

  it("EXAM-010 — strips letters and blocks saving a malformed number", async () => {
    const { user } = startExam();
    await user.click(screen.getByRole("tab", { name: /^Mathematics/ }));
    const input = screen.getByLabelText("Your answer");

    await user.type(input, "1a2b");
    expect(input).toHaveValue("12");

    await user.clear(input);
    await user.type(input, "1.2.3");
    await user.click(click.saveNext());

    expect(screen.getByText("Enter a valid number")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(heading()).toHaveTextContent("Question 1"); // stayed on the question
    expect(live().responses.q3).toBeUndefined();
  });

  it("EXAM-011 — Save & Next moves on and the saved response is still there on return", async () => {
    const { user } = startExam();
    await user.click(option(/Option B for q1/));
    await user.click(click.saveNext());
    expect(heading()).toHaveTextContent("Question 2");

    await user.click(click.back());
    expect(option(/Option B for q1/)).toBeChecked();
  });

  it("discards an unsaved selection when leaving via the palette", async () => {
    const { user } = startExam();
    await user.click(option(/Option B for q1/));
    await user.click(paletteButton(2));
    await user.click(paletteButton(1));
    expect(option(/Option B for q1/)).not.toBeChecked();
    expect(live().responses.q1).toBeUndefined();
  });

  it("EXAM-012 — Clear Response removes the saved answer", async () => {
    const { user } = startExam();
    await user.click(option(/Option B for q1/));
    await user.click(click.saveNext());
    await user.click(click.back());

    await user.click(click.clear());
    expect(option(/Option B for q1/)).not.toBeChecked();
    expect(live().responses.q1).toBeUndefined();
    expect(paletteButton(1)).toHaveAccessibleName("Question 1, Not Answered");
  });
});

describe("ExamRunner — review and palette", () => {
  it("EXAM-013 — Mark for Review & Next flags an unanswered question and moves on", async () => {
    const { user } = startExam();
    await user.click(click.markNext());

    expect(heading()).toHaveTextContent("Question 2");
    expect(paletteButton(1)).toHaveAccessibleName("Question 1, Marked for Review");

    await user.click(paletteButton(1));
    expect(heading()).toHaveTextContent("Question 1");
  });

  it("EXAM-014 — answered + marked keeps the answer, shows the combined state and stays editable", async () => {
    const { user } = startExam();
    await user.click(option(/Option B for q1/));
    await user.click(click.markNext());

    expect(paletteButton(1)).toHaveAccessibleName("Question 1, Answered & Marked for Review");
    expect(live().responses.q1).toEqual({ optionIds: ["q1-b"] });

    await user.click(paletteButton(1));
    expect(option(/Option B for q1/)).toBeChecked();
    await user.click(option(/Option D for q1/));
    await user.click(click.saveNext());
    expect(live().responses.q1).toEqual({ optionIds: ["q1-d"] });
  });

  it("EXAM-015 — palette navigation opens the chosen question and leaves other answers alone", async () => {
    const { user } = startExam();
    await user.click(option(/Option B for q1/));
    await user.click(click.saveNext());
    await user.click(paletteButton(1));

    expect(heading()).toHaveTextContent("Question 1");
    expect(paletteButton(1)).toHaveAttribute("aria-current", "true");
    expect(live().responses).toEqual({ q1: { optionIds: ["q1-b"] } });
  });

  it("EXAM-016 / A11Y-005 — the palette and legend show all five states with text labels", async () => {
    const test = makeTest({
      sections: [
        {
          ...makeTest().sections[0],
          questions: [...makeTest().sections[0].questions, ...makeTest().sections[1].questions.map((q) => ({ ...q, id: `${q.id}x`, subjectId: "physics" as const }))],
        },
      ],
    });
    const { user } = startExam(test);
    // q1: answered + marked, q2: marked, q3x: answered, q4x: not visited ... after visiting q4x? no — leave q4x unvisited.
    await user.click(option(/Option B for q1/));
    await user.click(click.markNext()); // q1 answered-review → q2
    await user.click(click.markNext()); // q2 review → q3x
    await user.type(screen.getByLabelText("Your answer"), "3");
    await user.click(click.saveNext()); // q3x answered → q4x (visited, not answered)

    expect(paletteButton(1)).toHaveAccessibleName("Question 1, Answered & Marked for Review");
    expect(paletteButton(2)).toHaveAccessibleName("Question 2, Marked for Review");
    expect(paletteButton(3)).toHaveAccessibleName("Question 3, Answered");
    expect(paletteButton(4)).toHaveAccessibleName("Question 4, Not Answered");

    // The legend labels every state in words, with live counts.
    const legend = within(palette()).getAllByRole("listitem").map((li) => li.textContent);
    expect(legend).toEqual(["0Not Visited", "1Not Answered", "1Answered", "1Marked for Review", "1Answered & Marked for Review"]);
  });

  it("EXAM-017 — Back is disabled on the first question; Next on the last stays put", async () => {
    const { user } = startExam();
    expect(click.back()).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: /^Mathematics/ }));
    await user.click(paletteButton(2)); // last question overall
    await user.click(click.saveNext());

    expect(heading()).toHaveTextContent("Question 2");
    expect(live().currentQuestionId).toBe("q4");
    expect(await screen.findByText("This is the last question")).toBeInTheDocument();
  });

  it("EXAM-018 — switching sections changes the question set and keeps other sections' answers", async () => {
    const { user } = startExam();
    await user.click(option(/Option B for q1/));
    await user.click(click.saveNext());

    await user.click(screen.getByRole("tab", { name: /^Mathematics/ }));
    expect(screen.getByRole("tab", { name: /^Mathematics/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Your answer")).toBeInTheDocument(); // q3 is numerical
    expect(within(palette()).getByText("Mathematics")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^Physics/ }));
    expect(screen.getByRole("tab", { name: /^Physics/ })).toHaveTextContent("1/2");
    expect(live().responses.q1).toEqual({ optionIds: ["q1-b"] });
  });
});

describe("ExamRunner — timers", () => {
  it("EXAM-019 — the overall timer counts down from the test duration", async () => {
    startExam();
    expect(timer()).toHaveAccessibleName("Time left 00:30:00");

    await advance(65 * SECOND);
    expect(timer()).toHaveAccessibleName("Time left 00:28:55");
  });

  it("EXAM-021 — reaching zero auto-submits and opens the result", async () => {
    startExam();
    await advance(30 * MINUTE + SECOND);

    expect(router.replace).toHaveBeenCalledTimes(1);
    const [url] = router.replace.mock.calls[0];
    const attempt = getState().attempts.find((a) => `/results/${a.id}` === url);
    expect(attempt).toMatchObject({ testId: "t-fixture", autoSubmitted: true });
    expect(live()).toBeUndefined();
  });

  it("EXAM-020 — section timers run only for the active section", async () => {
    const { user } = startExam(makeSectionalTest());
    const t = () => timer().getAttribute("aria-label");
    expect(t()).toBe("Time left 00:05:00");
    expect(screen.getByText("Section left")).toBeInTheDocument();

    await advance(60 * SECOND);
    expect(t()).toBe("Time left 00:04:00");

    await user.click(screen.getByRole("tab", { name: /^Mathematics/ }));
    expect(t()).toBe("Time left 00:03:00");
    await advance(30 * SECOND);
    expect(t()).toBe("Time left 00:02:30");

    await user.click(screen.getByRole("tab", { name: /^Physics/ }));
    expect(t()).toBe("Time left 00:04:00"); // Physics was paused, not reset
  });

  it("EXAM-021 — an expired section locks and the exam moves to the next section", async () => {
    startExam(makeSectionalTest());
    await advance(5 * MINUTE + SECOND);

    expect(screen.getByRole("tab", { name: /Physics/ })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /^Mathematics/ })).toHaveAttribute("aria-selected", "true");
    expect(live("t-sectional-fixture").lockedSectionIds).toEqual(["s-phy"]);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("EXAM-021 — when every section has expired the exam is submitted", async () => {
    startExam(makeSectionalTest());
    await advance(5 * MINUTE + SECOND);
    await advance(3 * MINUTE + SECOND);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(getState().attempts[0]).toMatchObject({ testId: "t-sectional-fixture", autoSubmitted: true });
  });
});

describe("ExamRunner — submission", () => {
  async function answerSome(user: ReturnType<typeof startExam>["user"]) {
    await user.click(option(/Option B for q1/));
    await user.click(click.saveNext()); // q1 answered
    await user.click(click.markNext()); // q2 marked, → q3
    await user.type(screen.getByLabelText("Your answer"), "12.5");
    await user.click(click.markNext()); // q3 answered+marked, → q4 visited
  }

  it("EXAM-022 — the confirmation summarises answered, unanswered and marked questions per section", async () => {
    const { user } = startExam();
    await answerSome(user);
    await user.click(click.submit());

    const dialog = screen.getByRole("dialog", { name: "Submit your test?" });
    const rows = within(dialog)
      .getAllByRole("row")
      .map((r) => within(r).queryAllByRole("cell").map((c) => c.textContent));
    // Section, Questions, Answered, Not answered, Marked, Answered & marked, Not visited
    expect(rows.slice(1)).toEqual([
      ["Physics", "2", "1", "0", "1", "0", "0"],
      ["Mathematics", "2", "0", "1", "0", "1", "0"],
      ["Total", "4", "1", "1", "1", "1", "0"],
    ]);
    expect(dialog).toHaveAccessibleDescription(/Time remaining: 00:30:00/);
  });

  it("EXAM-023 — returning to the test closes the dialog and changes nothing", async () => {
    const { user } = startExam();
    await answerSome(user);
    const before = structuredClone(live());

    await user.click(click.submit());
    await user.click(screen.getByRole("button", { name: "Return to test" }));

    expect(screen.queryByRole("dialog", { name: "Submit your test?" })).not.toBeInTheDocument();
    expect(live()).toEqual(before);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("EXAM-024 — confirming ends the attempt and routes to the result", async () => {
    const { user } = startExam();
    await answerSome(user);
    await user.click(click.submit());
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Submit test/ }));

    const attempt = getState().attempts[0];
    expect(router.replace).toHaveBeenCalledWith(`/results/${attempt.id}`);
    expect(attempt).toMatchObject({ testId: "t-fixture", autoSubmitted: false });
    expect(attempt.result).toMatchObject({ score: 8, correct: 2 });
    expect(live()).toBeUndefined();
  });

  it("EXAM-029 — double-clicking submit creates a single result", async () => {
    const { user } = startExam();
    const before = getState().attempts.length;
    await user.click(click.submit());
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: /Submit test/ });
    await user.dblClick(confirm);

    expect(getState().attempts).toHaveLength(before + 1);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("shows a recoverable state when there is no attempt in progress", () => {
    renderWithStore(<ExamRunner testId="t-demo" />, { session: { learner: "learnerActive" } });
    expect(screen.getByText("No attempt in progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to instructions" })).toHaveAttribute("href", "/exam/t-demo");
  });
});
