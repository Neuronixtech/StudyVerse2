"use client";

import { useState } from "react";
import { ArrowLeft, Check, ClipboardList, Lightbulb, Lock, X } from "lucide-react";
import { Breadcrumbs } from "@/components/page-banner";
import { Badge, type Tone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Tabs } from "@/components/ui/tabs";
import { formatCorrect, formatResponse, QUESTION_TYPE_LABEL } from "@/lib/exam";
import { useSession } from "@/lib/hooks";
import type { QuestionEvaluation } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | QuestionEvaluation["outcome"];

/** Label colour for each outcome chip — white only where the background is dark enough (4.5:1). */
const CHIP_TEXT: Record<QuestionEvaluation["outcome"], string> = {
  correct: "text-white",
  incorrect: "text-white",
  partial: "text-amber-950",
  unattempted: "text-slate-700",
};

const OUTCOME: Record<QuestionEvaluation["outcome"], { label: string; tone: Tone; dot: string }> = {
  correct: { label: "Correct", tone: "green", dot: "bg-emerald-500" },
  incorrect: { label: "Incorrect", tone: "red", dot: "bg-red-500" },
  partial: { label: "Partially correct", tone: "amber", dot: "bg-amber-500" },
  unattempted: { label: "Unattempted", tone: "slate", dot: "bg-slate-300" },
};

export function AnswerReview({ attemptId }: { attemptId: string }) {
  const { state, ready, learner } = useSession();
  const [filter, setFilter] = useState<Filter>("all");
  const [sectionId, setSectionId] = useState<string>("all");
  const attempt = state.attempts.find((a) => a.id === attemptId);

  if (!ready) {
    return (
      <div className="container-page space-y-4 py-12">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!attempt || (attempt.learnerId && attempt.learnerId !== learner?.id)) {
    return (
      <div className="container-page py-20">
        <EmptyState icon={<ClipboardList />} title="Review not available" description="This attempt isn't available for your account." action={<ButtonLink href="/tests">Browse tests</ButtonLink>} />
      </div>
    );
  }

  const test = state.tests.find((t) => t.id === attempt.testId);
  const released = test ? test.resultRelease === "immediate" || test.solutionsReleased : false;
  if (!released) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<Lock />}
          title="Solutions haven't been released yet"
          description="The StudyVerse team will release detailed solutions for this test after the review window. Your score is already final."
          action={<ButtonLink href={`/results/${attempt.id}`}>Back to result</ButtonLink>}
        />
      </div>
    );
  }

  const evals = new Map(attempt.result.evaluations.map((e) => [e.questionId, e]));
  const sections = attempt.snapshot.sections;
  const items = sections.flatMap((s, si) => {
    const offset = sections.slice(0, si).reduce((a, x) => a + x.questions.length, 0);
    return s.questions.map((q, qi) => ({ q, s, n: offset + qi + 1, ev: evals.get(q.id)! }));
  });
  const visible = items.filter((i) => (filter === "all" || i.ev.outcome === filter) && (sectionId === "all" || i.s.id === sectionId));
  const count = (f: Filter) => items.filter((i) => (f === "all" || i.ev.outcome === f) && (sectionId === "all" || i.s.id === sectionId)).length;

  return (
    <>
      <section className="border-b border-line bg-mist">
        <div className="container-page py-8">
          <Breadcrumbs items={[{ href: "/tests", label: "Tests" }, { href: `/results/${attempt.id}`, label: "Result" }, { label: "Answer review" }]} />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Answer review</h1>
          <p className="mt-1 text-sm text-slate-500">
            {attempt.snapshot.title} · Score {attempt.result.score}/{attempt.result.maxScore}
          </p>
        </div>
      </section>

      <div className="container-page grid grid-cols-1 gap-8 py-8 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          {sections.length > 1 && (
            <Tabs
              label="Section"
              variant="pill"
              value={sectionId}
              onChange={setSectionId}
              items={[{ value: "all", label: "All sections" }, ...sections.map((s) => ({ value: s.id, label: s.name }))]}
              className="mb-4 w-fit max-w-full"
            />
          )}
          <Tabs
            label="Outcome filter"
            value={filter}
            onChange={setFilter}
            items={[
              { value: "all", label: "All", count: count("all") },
              { value: "correct", label: "Correct", count: count("correct") },
              { value: "incorrect", label: "Incorrect", count: count("incorrect") },
              { value: "partial", label: "Partial", count: count("partial") },
              { value: "unattempted", label: "Unattempted", count: count("unattempted") },
            ]}
          />

          {visible.length === 0 ? (
            <EmptyState className="mt-6" icon={<ClipboardList />} title="No questions in this view" description="Try a different filter." />
          ) : (
            <ol className="mt-6 space-y-5">
              {visible.map(({ q, s, n, ev }) => {
                const response = attempt.responses[q.id];
                const o = OUTCOME[ev.outcome];
                return (
                  <li key={q.id} id={`q-${n}`} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-fg">Q{n}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-semibold text-slate-500">{s.name}</span>
                      <Badge tone="slate" size="xs">
                        {QUESTION_TYPE_LABEL[q.type]}
                      </Badge>
                      <span className="ml-auto flex items-center gap-2">
                        <Badge tone={o.tone}>{o.label}</Badge>
                        <span className={cn("text-sm font-extrabold", ev.marks > 0 ? "text-emerald-700 dark:text-emerald-300" : ev.marks < 0 ? "text-red-600 dark:text-red-400" : "text-slate-500")}>
                          {ev.marks > 0 ? `+${ev.marks}` : ev.marks}
                        </span>
                      </span>
                    </div>
                    <p className="mt-3 leading-relaxed font-medium text-fg">{q.text}</p>

                    {q.type === "numerical" ? (
                      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className={cn("rounded-xl p-3 ring-1", ev.outcome === "correct" ? "bg-emerald-50 dark:bg-emerald-500/10 ring-emerald-200 dark:ring-emerald-500/30" : ev.outcome === "unattempted" ? "bg-slate-50 ring-slate-200" : "bg-red-50 dark:bg-red-500/10 ring-red-200 dark:ring-red-500/30")}>
                          <dt className="text-xs font-semibold text-slate-500">Your answer</dt>
                          <dd className="font-mono text-lg font-bold text-fg">{formatResponse(q, response)}</dd>
                        </div>
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 ring-1 ring-emerald-200 dark:ring-emerald-500/30">
                          <dt className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Correct answer</dt>
                          <dd className="font-mono text-lg font-bold text-emerald-900 dark:text-emerald-100">{formatCorrect(q)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <ul className="mt-4 space-y-2">
                        {q.options.map((opt, i) => {
                          const chosen = response?.optionIds?.includes(opt.id) ?? false;
                          const correct = q.correctOptionIds.includes(opt.id);
                          return (
                            <li
                              key={opt.id}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-sm",
                                correct ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10" : chosen ? "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10" : "border-line",
                              )}
                            >
                              <span className={cn("grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold", correct ? "bg-emerald-600 text-white" : chosen ? "bg-red-500 text-white" : "bg-slate-100 text-slate-600")}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="flex-1 text-fg">{opt.text}</span>
                              {chosen && <span className="text-xs font-semibold text-slate-500">Your choice</span>}
                              {correct ? <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-label="Correct option" /> : chosen ? <X className="size-4 text-red-500" aria-label="Incorrect choice" /> : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <div className="mt-4 rounded-xl bg-brand-50/70 dark:bg-brand-400/10 p-4 ring-1 ring-brand-100 dark:ring-brand-400/20">
                      <p className="flex items-center gap-2 text-sm font-bold text-brand-800 dark:text-brand-200">
                        <Lightbulb className="size-4" /> Explanation
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{q.explanation}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="text-sm font-bold text-fg">Jump to question</p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {items.map(({ n, ev }) => (
                <a
                  key={n}
                  href={`#q-${n}`}
                  onClick={() => {
                    setFilter("all");
                    setSectionId("all");
                  }}
                  className={cn("grid size-9 place-items-center rounded-lg text-xs font-bold", OUTCOME[ev.outcome].dot, CHIP_TEXT[ev.outcome])}
                  aria-label={`Question ${n}: ${OUTCOME[ev.outcome].label}`}
                >
                  {n}
                </a>
              ))}
            </div>
            <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs">
              {Object.values(OUTCOME).map((o) => (
                <li key={o.label} className="flex items-center gap-2">
                  <span className={cn("size-3 rounded", o.dot)} /> {o.label}
                </li>
              ))}
            </ul>
            <ButtonLink href={`/results/${attempt.id}`} variant="secondary" size="sm" block className="mt-4">
              <ArrowLeft /> Back to result
            </ButtonLink>
          </div>
        </aside>
      </div>
    </>
  );
}
