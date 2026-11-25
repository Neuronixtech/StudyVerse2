import { describe, expect, it } from "vitest";
import {
  countStates,
  describeMultiRule,
  evaluateQuestion,
  formatCorrect,
  formatResponse,
  hasResponse,
  maxScoreOf,
  questionCount,
  questionTypesIn,
  scoreSnapshot,
  snapshotOf,
  STATE_LABEL,
  stateOf,
  totalDurationMin,
  validateNumerical,
} from "./exam";
import type { QuestionState } from "./types";
import { JEE_MARKS, makeLive, makeSectionalTest, makeTest, multiQ, numericalQ, singleQ } from "@/test/fixtures/exams";

describe("hasResponse", () => {
  it("treats missing or empty option selections as unanswered", () => {
    const q = singleQ("q");
    expect(hasResponse(q, undefined)).toBe(false);
    expect(hasResponse(q, {})).toBe(false);
    expect(hasResponse(q, { optionIds: [] })).toBe(false);
    expect(hasResponse(q, { optionIds: ["q-a"] })).toBe(true);
  });

  it("requires a parseable number for numerical questions", () => {
    const q = numericalQ("n");
    expect(hasResponse(q, { value: "" })).toBe(false);
    expect(hasResponse(q, { value: "   " })).toBe(false);
    expect(hasResponse(q, { value: "abc" })).toBe(false);
    expect(hasResponse(q, { value: "0" })).toBe(true);
    expect(hasResponse(q, { value: "12.5" })).toBe(true);
  });
});

describe("EXAM-010 — validateNumerical", () => {
  it.each(["", "  ", "0", "12", "12.5", ".5", "5."])("accepts %j", (raw) => {
    expect(validateNumerical(raw, false)).toBeNull();
  });

  it.each(["abc", "1.2.3", "1e5", "12a", "-", ".", "-.", "1-2", "+3"])("rejects %j as not a number", (raw) => {
    expect(validateNumerical(raw, true)).toBe("Enter a valid number");
  });

  it("rejects negatives only when the question disallows them", () => {
    expect(validateNumerical("-3", false)).toBe("Negative values are not accepted");
    expect(validateNumerical("-3", true)).toBeNull();
  });
});

describe("evaluateQuestion", () => {
  describe("single-correct", () => {
    const q = singleQ("s");

    it("awards full marks for the correct option", () => {
      expect(evaluateQuestion(q, { optionIds: ["s-b"] }, JEE_MARKS, "partial")).toEqual({ questionId: "s", outcome: "correct", marks: 4 });
    });

    it("applies the negative mark for a wrong option", () => {
      expect(evaluateQuestion(q, { optionIds: ["s-a"] }, JEE_MARKS, "partial")).toEqual({ questionId: "s", outcome: "incorrect", marks: -1 });
    });

    it("scores an unattempted question with the unattempted mark", () => {
      expect(evaluateQuestion(q, undefined, JEE_MARKS, "partial")).toEqual({ questionId: "s", outcome: "unattempted", marks: 0 });
    });

    it("never credits a response that somehow selects more than one option", () => {
      expect(evaluateQuestion(q, { optionIds: ["s-b", "s-c"] }, JEE_MARKS, "partial").outcome).toBe("incorrect");
    });

    it("uses a per-question marks override when present", () => {
      const custom = singleQ("c", { marks: { correct: 3, incorrect: -2, unattempted: 0 } });
      expect(evaluateQuestion(custom, { optionIds: ["c-b"] }, JEE_MARKS, "partial").marks).toBe(3);
      expect(evaluateQuestion(custom, { optionIds: ["c-a"] }, JEE_MARKS, "partial").marks).toBe(-2);
    });
  });

  describe("multi-select (correct = a, c)", () => {
    const q = multiQ("m");

    it("awards full marks only for exactly the correct set", () => {
      expect(evaluateQuestion(q, { optionIds: ["m-c", "m-a"] }, JEE_MARKS, "partial")).toMatchObject({ outcome: "correct", marks: 4 });
    });

    it("partial rule: +1 per correct option when no wrong option is chosen", () => {
      expect(evaluateQuestion(q, { optionIds: ["m-a"] }, JEE_MARKS, "partial")).toMatchObject({ outcome: "partial", marks: 1 });
    });

    it("partial rule: any wrong option makes the answer incorrect", () => {
      expect(evaluateQuestion(q, { optionIds: ["m-a", "m-b"] }, JEE_MARKS, "partial")).toMatchObject({ outcome: "incorrect", marks: -1 });
    });

    it("all-or-nothing rule: a correct subset is incorrect", () => {
      expect(evaluateQuestion(q, { optionIds: ["m-a"] }, JEE_MARKS, "all-or-nothing")).toMatchObject({ outcome: "incorrect", marks: -1 });
    });

    it("selecting every option is incorrect", () => {
      expect(evaluateQuestion(q, { optionIds: ["m-a", "m-b", "m-c", "m-d"] }, JEE_MARKS, "partial").outcome).toBe("incorrect");
    });
  });

  describe("numerical (12.5 ± 0.1)", () => {
    const q = numericalQ("n");

    it.each(["12.5", "12.4", "12.6", "12.50"])("accepts %s inside the tolerance (boundaries included)", (value) => {
      expect(evaluateQuestion(q, { value }, JEE_MARKS, "partial")).toMatchObject({ outcome: "correct", marks: 4 });
    });

    it.each(["12.39", "12.61", "-12.5", "125"])("rejects %s outside the tolerance", (value) => {
      expect(evaluateQuestion(q, { value }, JEE_MARKS, "partial")).toMatchObject({ outcome: "incorrect", marks: -1 });
    });

    it("treats a non-numeric entry as unattempted rather than wrong", () => {
      expect(evaluateQuestion(q, { value: "abc" }, JEE_MARKS, "partial")).toMatchObject({ outcome: "unattempted", marks: 0 });
    });

    it("requires an exact match when tolerance is zero", () => {
      const exact = numericalQ("e", { value: 7, tolerance: 0 });
      expect(evaluateQuestion(exact, { value: "7" }, JEE_MARKS, "partial").outcome).toBe("correct");
      expect(evaluateQuestion(exact, { value: "7.01" }, JEE_MARKS, "partial").outcome).toBe("incorrect");
    });
  });
});

describe("EXAM-025 — scoreSnapshot", () => {
  it("produces score, counts and section breakdown that match the marking scheme", () => {
    const test = makeTest();
    // q1 single correct (+4), q2 multi partial (+1), q3 numerical wrong (−1), q4 unattempted (0)
    const result = scoreSnapshot(test, {
      q1: { optionIds: ["q1-b"] },
      q2: { optionIds: ["q2-a"] },
      q3: { value: "99" },
    });

    expect(result).toMatchObject({ score: 4, maxScore: 16, correct: 1, partial: 1, incorrect: 1, unattempted: 1 });
    expect(result.sections).toEqual([
      { sectionId: "s-phy", name: "Physics", total: 2, correct: 1, incorrect: 0, partial: 1, unattempted: 0, score: 5, maxScore: 8 },
      { sectionId: "s-math", name: "Mathematics", total: 2, correct: 0, incorrect: 1, partial: 0, unattempted: 1, score: -1, maxScore: 8 },
    ]);
    expect(result.evaluations.map((e) => e.questionId)).toEqual(["q1", "q2", "q3", "q4"]);
  });

  it("scores an empty attempt as all unattempted", () => {
    const result = scoreSnapshot(makeTest(), {});
    expect(result).toMatchObject({ score: 0, correct: 0, incorrect: 0, partial: 0, unattempted: 4 });
  });

  it("allows a negative total score", () => {
    const result = scoreSnapshot(makeTest(), { q1: { optionIds: ["q1-a"] }, q4: { optionIds: ["q4-a"] } });
    expect(result.score).toBe(-2);
  });
});

describe("EXAM-016 / EXAM-014 — question palette state", () => {
  const q = singleQ("q");

  it.each<[string, QuestionState, Parameters<typeof makeLive>[0]]>([
    ["never opened", "not-visited", {}],
    ["opened but not answered", "not-answered", { visited: ["q"] }],
    ["answered", "answered", { visited: ["q"], responses: { q: { optionIds: ["q-a"] } } }],
    ["marked without an answer", "review", { visited: ["q"], marked: ["q"] }],
    ["answered and marked", "answered-review", { visited: ["q"], marked: ["q"], responses: { q: { optionIds: ["q-a"] } } }],
  ])("%s → %s", (_label, expected, live) => {
    expect(stateOf(makeLive(live), q)).toBe(expected);
  });

  it("EXAM-012 — clearing the response of a visited question returns it to not-answered", () => {
    expect(stateOf(makeLive({ visited: ["q"], responses: {} }), q)).toBe("not-answered");
  });

  it("EXAM-012 — clearing a marked question keeps it marked for review", () => {
    expect(stateOf(makeLive({ visited: ["q"], marked: ["q"], responses: {} }), q)).toBe("review");
  });

  it("an invalid numerical entry does not count as answered", () => {
    const n = numericalQ("n");
    expect(stateOf(makeLive({ visited: ["n"], responses: { n: { value: "." } } }), n)).toBe("not-answered");
  });

  it("A11Y-005 — every state has its own text label, not just a colour", () => {
    const labels = Object.values(STATE_LABEL);
    expect(labels).toHaveLength(5);
    expect(new Set(labels).size).toBe(5);
    expect(STATE_LABEL["answered-review"]).toBe("Answered & Marked for Review");
  });

  it("countStates tallies every state, including zeros", () => {
    expect(countStates(["answered", "answered", "review", "not-visited"])).toEqual({
      "not-visited": 1,
      "not-answered": 0,
      answered: 2,
      review: 1,
      "answered-review": 0,
    });
  });
});

describe("test metadata helpers", () => {
  it("uses the overall duration for overall-timed tests", () => {
    expect(totalDurationMin(makeTest({ durationMin: 45 }))).toBe(45);
  });

  it("sums section durations for sectional tests, ignoring the overall duration", () => {
    expect(totalDurationMin(makeSectionalTest({ durationMin: 999 }))).toBe(8);
  });

  it("counts questions across sections", () => {
    expect(questionCount(makeTest())).toBe(4);
  });

  it("computes the maximum score, honouring per-question overrides", () => {
    const test = makeTest();
    test.sections[0].questions[0] = singleQ("q1", { marks: { correct: 10, incorrect: 0, unattempted: 0 } });
    expect(maxScoreOf(test)).toBe(10 + 4 + 4 + 4);
  });

  it("lists question types in a fixed order", () => {
    expect(questionTypesIn(makeTest())).toEqual(["single", "multi", "numerical"]);
  });

  it("describes both multi-select marking rules", () => {
    expect(describeMultiRule("all-or-nothing", JEE_MARKS)).toMatch(/only if all correct options are selected/);
    expect(describeMultiRule("partial", JEE_MARKS)).toMatch(/partial marking/);
  });
});

describe("ADMIN-011 — snapshotOf protects attempt history", () => {
  it("deep-copies sections so later edits to the test never rewrite a snapshot", () => {
    const test = makeTest({ version: 3 });
    const snap = snapshotOf(test);

    test.title = "Renamed";
    test.sections[0].questions[0].text = "Edited question text";
    test.sections[0].questions[0].correctOptionIds = ["q1-d"];

    expect(snap).toMatchObject({ testId: "t-fixture", version: 3, title: "Fixture Mock Test" });
    expect(snap.sections[0].questions[0].text).toBe("Single-correct question q1");
    expect(snap.sections[0].questions[0].correctOptionIds).toEqual(["q1-b"]);
  });

  it("records the effective total duration for sectional tests", () => {
    expect(snapshotOf(makeSectionalTest()).durationMin).toBe(8);
  });
});

describe("response formatting for results", () => {
  it("formats selected options as letters", () => {
    const q = multiQ("m");
    expect(formatResponse(q, { optionIds: ["m-c", "m-a"] })).toBe("A, C");
    expect(formatResponse(q, undefined)).toBe("Not attempted");
  });

  it("formats numerical answers and tolerance", () => {
    expect(formatResponse(numericalQ("n"), { value: "12.4" })).toBe("12.4");
    expect(formatCorrect(numericalQ("n"))).toBe("12.5 (± 0.1)");
    expect(formatCorrect(numericalQ("x", { value: 3, tolerance: 0 }))).toBe("3");
  });

  it("formats the correct options as letters", () => {
    expect(formatCorrect(multiQ("m"))).toBe("A, C");
    expect(formatCorrect(singleQ("s"))).toBe("B");
  });
});
