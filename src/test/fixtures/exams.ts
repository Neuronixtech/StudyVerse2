import { scoreSnapshot, snapshotOf, stateOf } from "@/lib/exam";
import type { Attempt, LiveExam, Marks, Question, QuestionOption, QuestionResponse, Test, TestSection } from "@/lib/types";
import { FIXED_NOW } from "./time";

/** JEE Main style marking: +4 / −1 / 0 */
export const JEE_MARKS: Marks = { correct: 4, incorrect: -1, unattempted: 0 };

const options = (qid: string, count = 4): QuestionOption[] =>
  Array.from({ length: count }, (_, i) => {
    const letter = String.fromCharCode(97 + i);
    return { id: `${qid}-${letter}`, text: `Option ${letter.toUpperCase()} for ${qid}` };
  });

/** Single-correct MCQ. Options are `<id>-a`…`<id>-d`; correct option defaults to `<id>-b`. */
export function singleQ(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    type: "single",
    text: `Single-correct question ${id}`,
    subjectId: "physics",
    options: options(id),
    correctOptionIds: [`${id}-b`],
    explanation: `Explanation for ${id}`,
    difficulty: "Easy",
    ...overrides,
  };
}

/** Multi-select question. Correct options default to `<id>-a` and `<id>-c`. */
export function multiQ(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    type: "multi",
    text: `Multi-select question ${id}`,
    subjectId: "chemistry",
    options: options(id),
    correctOptionIds: [`${id}-a`, `${id}-c`],
    explanation: `Explanation for ${id}`,
    difficulty: "Medium",
    ...overrides,
  };
}

/** Numerical-answer question. Correct value defaults to 12.5 ± 0.1, negatives not allowed. */
export function numericalQ(id: string, numerical: Partial<NonNullable<Question["numerical"]>> = {}, overrides: Partial<Question> = {}): Question {
  return {
    id,
    type: "numerical",
    text: `Numerical question ${id}`,
    subjectId: "mathematics",
    options: [],
    correctOptionIds: [],
    numerical: { value: 12.5, tolerance: 0.1, precision: 1, allowNegative: false, ...numerical },
    explanation: `Explanation for ${id}`,
    difficulty: "Hard",
    ...overrides,
  };
}

export function makeSection(id: string, name: string, questions: Question[], durationMin = 0): TestSection {
  return { id, name, durationMin, questions };
}

/**
 * A published regular test with two sections covering all three question types:
 *   Physics:   q1 (single), q2 (multi)
 *   Maths:     q3 (numerical), q4 (single)
 */
export function makeTest(overrides: Partial<Test> = {}): Test {
  return {
    id: "t-fixture",
    slug: "fixture-test",
    title: "Fixture Mock Test",
    description: "A deterministic test used by the automated suite.",
    kind: "full",
    examId: "jee-main",
    subjectIds: ["physics", "mathematics"],
    isDemo: false,
    published: true,
    timingMode: "overall",
    durationMin: 30,
    sections: [
      makeSection("s-phy", "Physics", [singleQ("q1"), multiQ("q2")]),
      makeSection("s-math", "Mathematics", [numericalQ("q3"), singleQ("q4")]),
    ],
    defaultMarks: JEE_MARKS,
    multiMarking: "partial",
    attemptLimit: null,
    resultRelease: "immediate",
    solutionsReleased: true,
    version: 1,
    createdAt: FIXED_NOW - 30 * 86_400_000,
    updatedAt: FIXED_NOW - 2 * 86_400_000,
    ...overrides,
  };
}

/** A sectional-timed variant: Physics 5 min, Maths 3 min. */
export function makeSectionalTest(overrides: Partial<Test> = {}): Test {
  const base = makeTest();
  return makeTest({
    id: "t-sectional-fixture",
    title: "Sectional Fixture Test",
    timingMode: "sectional",
    sections: [
      { ...base.sections[0], durationMin: 5 },
      { ...base.sections[1], durationMin: 3 },
    ],
    ...overrides,
  });
}

/**
 * A submitted attempt scored exactly as the app would score it.
 * Every question is treated as visited; questions with a response are "answered".
 */
export function makeAttempt(test: Test, responses: Record<string, QuestionResponse>, overrides: Partial<Attempt> = {}): Attempt {
  const snapshot = snapshotOf(test);
  const ids = snapshot.sections.flatMap((s) => s.questions.map((q) => q.id));
  const live = { visited: ids, marked: [], responses };
  return {
    id: "at-fixture",
    testId: test.id,
    learnerId: "l-rohan",
    startedAt: FIXED_NOW - 20 * 60_000,
    submittedAt: FIXED_NOW,
    autoSubmitted: false,
    timeTakenSec: 20 * 60,
    snapshot,
    responses,
    states: Object.fromEntries(snapshot.sections.flatMap((s) => s.questions.map((q) => [q.id, stateOf(live, q)]))),
    result: scoreSnapshot(snapshot, responses),
    ...overrides,
  };
}

/** Live-exam state for palette/state tests. */
export function makeLive(overrides: Partial<Pick<LiveExam, "visited" | "marked" | "responses">> = {}): Pick<LiveExam, "visited" | "marked" | "responses"> {
  return { visited: [], marked: [], responses: {}, ...overrides };
}
