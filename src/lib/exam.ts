import type {
  AttemptResult,
  LiveExam,
  Marks,
  MultiMarkingRule,
  Question,
  QuestionEvaluation,
  QuestionResponse,
  QuestionState,
  SectionResult,
  Test,
  TestSnapshot,
} from "./types";

export const QUESTION_TYPE_LABEL: Record<Question["type"], string> = {
  single: "Single correct",
  multi: "Multi-select",
  numerical: "Numerical",
};

export const QUESTION_TYPE_SHORT: Record<Question["type"], string> = {
  single: "MCQ",
  multi: "MSQ",
  numerical: "NUM",
};

export function marksFor(q: Question, defaults: Marks): Marks {
  return q.marks ?? defaults;
}

export function hasResponse(q: Question, r: QuestionResponse | undefined): boolean {
  if (!r) return false;
  if (q.type === "numerical") return (r.value ?? "").trim() !== "" && !Number.isNaN(Number(r.value));
  return (r.optionIds?.length ?? 0) > 0;
}

/** Validates a raw numerical entry. Returns an error message or null. */
export function validateNumerical(raw: string, allowNegative: boolean): string | null {
  const v = raw.trim();
  if (v === "") return null;
  if (!/^-?\d*\.?\d*$/.test(v) || v === "-" || v === "." || v === "-.") return "Enter a valid number";
  if (!allowNegative && v.startsWith("-")) return "Negative values are not accepted";
  return null;
}

export function evaluateQuestion(
  q: Question,
  r: QuestionResponse | undefined,
  defaults: Marks,
  multiRule: MultiMarkingRule,
): QuestionEvaluation {
  const marks = marksFor(q, defaults);
  if (!hasResponse(q, r)) {
    return { questionId: q.id, outcome: "unattempted", marks: marks.unattempted };
  }

  if (q.type === "numerical" && q.numerical) {
    const value = Number(r!.value);
    const ok = Math.abs(value - q.numerical.value) <= q.numerical.tolerance + 1e-9;
    return { questionId: q.id, outcome: ok ? "correct" : "incorrect", marks: ok ? marks.correct : marks.incorrect };
  }

  const chosen = new Set(r!.optionIds ?? []);
  const correct = new Set(q.correctOptionIds);

  if (q.type === "single") {
    const ok = chosen.size === 1 && correct.has([...chosen][0]);
    return { questionId: q.id, outcome: ok ? "correct" : "incorrect", marks: ok ? marks.correct : marks.incorrect };
  }

  // multi-select
  const anyWrong = [...chosen].some((id) => !correct.has(id));
  const allRight = [...correct].every((id) => chosen.has(id)) && chosen.size === correct.size;
  if (allRight) return { questionId: q.id, outcome: "correct", marks: marks.correct };
  if (anyWrong || multiRule === "all-or-nothing") {
    return { questionId: q.id, outcome: "incorrect", marks: marks.incorrect };
  }
  // partial: +1 for each correct option chosen, no wrong option chosen
  return { questionId: q.id, outcome: "partial", marks: chosen.size };
}

export function scoreSnapshot(
  snapshot: Pick<TestSnapshot, "sections" | "defaultMarks" | "multiMarking">,
  responses: Record<string, QuestionResponse>,
): AttemptResult {
  const evaluations: QuestionEvaluation[] = [];
  const sections: SectionResult[] = snapshot.sections.map((s) => {
    const res: SectionResult = {
      sectionId: s.id,
      name: s.name,
      total: s.questions.length,
      correct: 0,
      incorrect: 0,
      partial: 0,
      unattempted: 0,
      score: 0,
      maxScore: 0,
    };
    for (const q of s.questions) {
      const ev = evaluateQuestion(q, responses[q.id], snapshot.defaultMarks, snapshot.multiMarking);
      evaluations.push(ev);
      res[ev.outcome] += 1;
      res.score += ev.marks;
      res.maxScore += marksFor(q, snapshot.defaultMarks).correct;
    }
    return res;
  });

  return {
    score: sections.reduce((a, s) => a + s.score, 0),
    maxScore: sections.reduce((a, s) => a + s.maxScore, 0),
    correct: sections.reduce((a, s) => a + s.correct, 0),
    incorrect: sections.reduce((a, s) => a + s.incorrect, 0),
    partial: sections.reduce((a, s) => a + s.partial, 0),
    unattempted: sections.reduce((a, s) => a + s.unattempted, 0),
    sections,
    evaluations,
  };
}

export function snapshotOf(test: Test): TestSnapshot {
  return {
    testId: test.id,
    version: test.version,
    title: test.title,
    timingMode: test.timingMode,
    durationMin: totalDurationMin(test),
    defaultMarks: { ...test.defaultMarks },
    multiMarking: test.multiMarking,
    // Deep copy so later admin edits never rewrite history
    sections: JSON.parse(JSON.stringify(test.sections)),
  };
}

export function totalDurationMin(test: Pick<Test, "timingMode" | "durationMin" | "sections">): number {
  return test.timingMode === "sectional"
    ? test.sections.reduce((a, s) => a + s.durationMin, 0)
    : test.durationMin;
}

export function questionCount(test: Pick<Test, "sections">): number {
  return test.sections.reduce((a, s) => a + s.questions.length, 0);
}

export function maxScoreOf(test: Pick<Test, "sections" | "defaultMarks">): number {
  return test.sections.reduce(
    (a, s) => a + s.questions.reduce((b, q) => b + marksFor(q, test.defaultMarks).correct, 0),
    0,
  );
}

export function questionTypesIn(test: Pick<Test, "sections">): Question["type"][] {
  const set = new Set<Question["type"]>();
  test.sections.forEach((s) => s.questions.forEach((q) => set.add(q.type)));
  return (["single", "multi", "numerical"] as const).filter((t) => set.has(t));
}

export function stateOf(live: Pick<LiveExam, "visited" | "marked" | "responses">, q: Question): QuestionState {
  const answered = hasResponse(q, live.responses[q.id]);
  const marked = live.marked.includes(q.id);
  if (marked && answered) return "answered-review";
  if (marked) return "review";
  if (answered) return "answered";
  if (live.visited.includes(q.id)) return "not-answered";
  return "not-visited";
}

export const STATE_LABEL: Record<QuestionState, string> = {
  "not-visited": "Not Visited",
  "not-answered": "Not Answered",
  answered: "Answered",
  review: "Marked for Review",
  "answered-review": "Answered & Marked for Review",
};

export function countStates(states: QuestionState[]): Record<QuestionState, number> {
  const out: Record<QuestionState, number> = {
    "not-visited": 0,
    "not-answered": 0,
    answered: 0,
    review: 0,
    "answered-review": 0,
  };
  states.forEach((s) => (out[s] += 1));
  return out;
}

export function describeMultiRule(rule: MultiMarkingRule, marks: Marks): string {
  if (rule === "all-or-nothing") {
    return `Full marks (+${marks.correct}) only if all correct options are selected and no incorrect option is selected; otherwise ${marks.incorrect} mark${Math.abs(marks.incorrect) === 1 ? "" : "s"}.`;
  }
  return `+${marks.correct} if all correct options are selected. +1 for each correct option selected when no incorrect option is chosen (partial marking). ${marks.incorrect} if any incorrect option is selected.`;
}

export function formatResponse(q: Question, r: QuestionResponse | undefined): string {
  if (!hasResponse(q, r)) return "Not attempted";
  if (q.type === "numerical") return String(r!.value);
  return q.options
    .map((o, i) => ((r!.optionIds ?? []).includes(o.id) ? String.fromCharCode(65 + i) : null))
    .filter(Boolean)
    .join(", ");
}

export function formatCorrect(q: Question): string {
  if (q.type === "numerical" && q.numerical) {
    return q.numerical.tolerance > 0
      ? `${q.numerical.value} (± ${q.numerical.tolerance})`
      : String(q.numerical.value);
  }
  return q.options
    .map((o, i) => (q.correctOptionIds.includes(o.id) ? String.fromCharCode(65 + i) : null))
    .filter(Boolean)
    .join(", ");
}
