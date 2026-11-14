"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, ClipboardList, Eraser, Grid3x3, LoaderCircle, Lock, LogOut, Send, Timer } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar, EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog, Drawer, Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { countStates, hasResponse, marksFor, QUESTION_TYPE_LABEL, stateOf, validateNumerical } from "@/lib/exam";
import { useSession } from "@/lib/hooks";
import { liveKey, submitLiveExam, updateLiveExam, useNow } from "@/lib/store";
import type { LiveExam, Question, QuestionResponse, TestSection } from "@/lib/types";
import { cn, formatTimer } from "@/lib/utils";
import { ExamHeader } from "./exam-header";
import { NumericInput } from "./numeric-keypad";
import { PaletteCell, PaletteLegend } from "./palette";

/* ----------------------------- helpers ----------------------------- */

function sectionRemaining(live: LiveExam, section: TestSection, now: number): number {
  const running = section.id === live.currentSectionId ? Math.max(0, now - live.sectionActiveSince) / 1000 : 0;
  return section.durationMin * 60 - (live.sectionElapsed[section.id] ?? 0) - running;
}

/** Move to a question, tracking visits and pausing/resuming section timers */
function visit(l: LiveExam, sectionId: string, questionId: string): LiveExam {
  let next: LiveExam = {
    ...l,
    currentQuestionId: questionId,
    visited: l.visited.includes(questionId) ? l.visited : [...l.visited, questionId],
  };
  if (sectionId !== l.currentSectionId) {
    const t = Date.now();
    next = {
      ...next,
      currentSectionId: sectionId,
      sectionElapsed: {
        ...l.sectionElapsed,
        [l.currentSectionId]: (l.sectionElapsed[l.currentSectionId] ?? 0) + Math.max(0, t - l.sectionActiveSince) / 1000,
      },
      sectionActiveSince: t,
    };
  }
  return next;
}

function withResponse(l: LiveExam, q: Question, r: QuestionResponse | undefined): LiveExam {
  const responses = { ...l.responses };
  if (r && hasResponse(q, r)) responses[q.id] = r;
  else delete responses[q.id];
  return { ...l, responses };
}

/* ------------------------------ runner ------------------------------ */

export function ExamRunner({ testId }: { testId: string }) {
  const router = useRouter();
  const { state, ready, learner } = useSession();
  const now = useNow(1000);
  const key = liveKey(learner?.id ?? null, testId);
  const live = state.liveExams[key];

  const [draft, setDraft] = useState<{ qid: string; r: QuestionResponse } | null>(null);
  const [numError, setNumError] = useState<{ qid: string; msg: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const submittingRef = useRef(false);
  const warnedRef = useRef({ five: false, one: false });

  const snapshot = live?.snapshot;
  const sectional = snapshot?.timingMode === "sectional";
  const section = snapshot?.sections.find((s) => s.id === live?.currentSectionId);
  const qIndex = section ? section.questions.findIndex((q) => q.id === live?.currentQuestionId) : -1;
  const question = section?.questions[qIndex];

  const clockValid = ready && !!live && now >= live.startedAt - 2000;
  const remaining = !live || !snapshot || !section
    ? 0
    : sectional
      ? sectionRemaining(live, section, now)
      : (live.startedAt + snapshot.durationMin * 60_000 - now) / 1000;

  const finish = (auto: boolean) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const id = submitLiveExam(key, auto);
    if (id) router.replace(`/results/${id}`);
  };

  // Timer expiry: auto-submit (overall) or lock section and move on (sectional)
  useEffect(() => {
    if (!live || !snapshot || !section || !clockValid || submittingRef.current) return;
    if (remaining > 0) return;
    if (!sectional) {
      toast({ title: "Time's up", description: "Your test was submitted automatically.", tone: "info" });
      finish(true);
      return;
    }
    const locked = [...live.lockedSectionIds, section.id];
    const nextSection = snapshot.sections.find((s) => !locked.includes(s.id) && sectionRemaining(live, s, now) > 0);
    if (!nextSection) {
      toast({ title: "All section timers have ended", description: "Your test was submitted automatically.", tone: "info" });
      finish(true);
      return;
    }
    updateLiveExam(key, (l) => {
      const moved = visit(l, nextSection.id, nextSection.questions[0].id);
      return { ...moved, lockedSectionIds: locked, sectionElapsed: { ...moved.sectionElapsed, [section.id]: section.durationMin * 60 } };
    });
    toast({ title: `${section.name}: time is over`, description: `This section is now locked. Continue with ${nextSection.name}.`, tone: "info" });
  });

  // Low-time warnings for the overall timer
  useEffect(() => {
    if (!clockValid || sectional) return;
    if (remaining <= 300 && remaining > 60 && !warnedRef.current.five) {
      warnedRef.current.five = true;
      toast({ title: "5 minutes remaining", description: "Review marked questions before time runs out.", tone: "info" });
    }
    if (remaining <= 60 && remaining > 0 && !warnedRef.current.one) {
      warnedRef.current.one = true;
      toast({ title: "1 minute remaining", description: "The test will be submitted automatically.", tone: "error" });
    }
  }, [remaining, clockValid, sectional]);

  /* ----------------------------- states ----------------------------- */

  if (!ready) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <LoaderCircle className="mx-auto size-8 animate-spin text-brand-600 dark:text-brand-400" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Loading your exam…</p>
        </div>
      </div>
    );
  }

  if (!live || !snapshot || !section || !question) {
    const justSubmitted = state.attempts.find((a) => a.testId === testId && a.learnerId === (learner?.id ?? null) && now - a.submittedAt < 20_000);
    if (justSubmitted) {
      return (
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div>
            <LoaderCircle className="mx-auto size-8 animate-spin text-brand-600 dark:text-brand-400" />
            <p className="mt-3 text-sm font-semibold text-slate-600">Submitting your test…</p>
            <Link href={`/results/${justSubmitted.id}`} className="mt-2 inline-block text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">
              View result
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-xl flex-1 px-4 py-20">
        <EmptyState
          icon={<ClipboardList />}
          title="No attempt in progress"
          description="Start the test from its instructions screen."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={`/exam/${testId}`}>Go to instructions</ButtonLink>
              <ButtonLink href={`/tests/${testId}`} variant="secondary">
                Test details
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  /* ---------------------------- derived ---------------------------- */

  const saved = live.responses[question.id];
  const current: QuestionResponse | undefined = draft?.qid === question.id ? draft.r : saved;
  const marks = marksFor(question, snapshot.defaultMarks);
  const unlockedSections = snapshot.sections.filter((s) => !live.lockedSectionIds.includes(s.id));
  const order = unlockedSections.flatMap((s) => s.questions.map((q) => ({ sectionId: s.id, qid: q.id })));
  const pos = order.findIndex((o) => o.qid === question.id);
  const nextStop = order[pos + 1];
  const prevStop = order[pos - 1];
  const sectionStates = section.questions.map((q) => stateOf(live, q));
  const sectionCounts = countStates(sectionStates);
  const lowTime = remaining <= 300;
  const criticalTime = remaining <= 60;
  const error = numError?.qid === question.id ? numError.msg : null;

  const setResponse = (r: QuestionResponse) => {
    setDraft({ qid: question.id, r });
    if (numError) setNumError(null);
  };

  const validateCurrent = (): boolean => {
    if (question.type !== "numerical" || !current?.value) return true;
    const msg = validateNumerical(current.value, question.numerical?.allowNegative ?? false);
    if (msg) {
      setNumError({ qid: question.id, msg });
      return false;
    }
    return true;
  };

  const advance = (mutate: (l: LiveExam) => LiveExam) => {
    updateLiveExam(key, (l) => {
      const changed = mutate(l);
      return nextStop ? visit(changed, nextStop.sectionId, nextStop.qid) : changed;
    });
    setDraft(null);
    if (!nextStop) toast({ title: "This is the last question", description: "Review your answers using the palette, then submit.", tone: "info" });
  };

  const saveAndNext = () => {
    if (!validateCurrent()) return;
    advance((l) => withResponse(l, question, current));
  };

  const markAndNext = () => {
    if (!validateCurrent()) return;
    advance((l) => {
      const keep = current && hasResponse(question, current) ? withResponse(l, question, current) : l;
      return { ...keep, marked: keep.marked.includes(question.id) ? keep.marked : [...keep.marked, question.id] };
    });
  };

  const clearResponse = () => {
    updateLiveExam(key, (l) => withResponse(l, question, undefined));
    setDraft(null);
    setNumError(null);
  };

  const goTo = (sectionId: string, qid: string) => {
    if (live.lockedSectionIds.includes(sectionId)) return;
    updateLiveExam(key, (l) => visit(l, sectionId, qid));
    setDraft(null);
    setNumError(null);
    setPaletteOpen(false);
  };

  /* ----------------------------- pieces ----------------------------- */

  const timer = (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Time left ${formatTimer(remaining)}`}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums sm:px-3 sm:text-base",
        criticalTime ? "animate-pulse bg-red-500 text-white" : lowTime ? "bg-amber-400 text-ink" : "bg-white/15 text-white",
      )}
    >
      <Timer className="size-4" />
      <span>
        <span className="sr-only sm:not-sr-only sm:mr-1.5 sm:font-sans sm:text-[11px] sm:font-semibold sm:opacity-80">{sectional ? "Section left" : "Time left"}</span>
        {formatTimer(remaining)}
      </span>
    </div>
  );

  const palettePanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line p-4">
        <Avatar name={learner?.name ?? "Guest candidate"} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-fg">{learner?.name ?? "Guest candidate"}</p>
          <p className="text-xs text-slate-500">{learner ? "Signed in" : "Demo attempt as guest"}</p>
        </div>
      </div>
      <div className="border-b border-line p-4">
        <PaletteLegend counts={sectionCounts} compact />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="mb-3 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white">{section.name}</p>
        <p className="mb-3 text-xs text-slate-500">Choose a question</p>
        <div className="grid grid-cols-5 gap-2.5">
          {section.questions.map((q, i) => {
            const st = sectionStates[i];
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => goTo(section.id, q.id)}
                aria-label={`Question ${i + 1}, ${st.replace("-", " ")}`}
                aria-current={q.id === question.id ? "true" : undefined}
                className="grid place-items-center rounded-md focus-visible:outline-offset-4"
              >
                <PaletteCell state={st} label={i + 1} current={q.id === question.id} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-line p-4">
        <Button block size="lg" onClick={() => setConfirmOpen(true)} className="bg-brand-700 hover:bg-brand-800">
          <Send /> Submit test
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <ExamHeader
        title={snapshot.title}
        candidate={learner?.name ?? "Guest candidate"}
        right={
          <div className="flex items-center gap-1.5 sm:gap-2">
            {timer}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="grid size-9 place-items-center rounded-lg bg-white/15 text-white hover:bg-white/25 lg:hidden"
              aria-label="Open question palette"
            >
              <Grid3x3 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setExitOpen(true)}
              className="hidden size-9 place-items-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white sm:grid"
              aria-label="Leave exam"
              title="Leave exam"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        }
      />

      {/* Section tabs */}
      {snapshot.sections.length > 1 && (
        <div className="shrink-0 border-b border-line bg-surface">
          <div role="tablist" aria-label="Sections" className="relative scrollbar-thin flex gap-1 overflow-x-auto px-2 sm:px-4">
            {snapshot.sections.map((s) => {
              const locked = live.lockedSectionIds.includes(s.id);
              const answered = s.questions.filter((q) => hasResponse(q, live.responses[q.id])).length;
              const active = s.id === section.id;
              const secLeft = sectional ? sectionRemaining(live, s, now) : 0;
              return (
                <button
                  key={s.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  disabled={locked}
                  onClick={() => {
                    const firstUnvisited = s.questions.find((q) => !live.visited.includes(q.id)) ?? s.questions[0];
                    goTo(s.id, firstUnvisited.id);
                  }}
                  className={cn(
                    "-mb-px flex shrink-0 items-center gap-2 border-b-[3px] px-3 py-3 text-sm font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    active ? "border-brand-600 text-brand-700 dark:text-brand-300" : "border-transparent text-slate-500 hover:text-fg",
                  )}
                >
                  {locked && <Lock className="size-3.5" />}
                  {s.name}
                  <span className={cn("rounded-full px-1.5 py-px text-[11px]", active ? "bg-brand-100 dark:bg-brand-400/15 text-brand-700 dark:text-brand-300" : "bg-slate-100 text-slate-500")}>
                    {answered}/{s.questions.length}
                  </span>
                  {sectional && !active && (
                    <span className="font-mono text-[11px] font-semibold text-slate-400">{locked ? "Time over" : formatTimer(secLeft)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Question + answer area */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
            <div className="mx-auto max-w-3xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <h1 className="text-lg font-extrabold text-fg">Question {qIndex + 1}</h1>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-md bg-slate-200/70 px-2 py-1 text-slate-700">{QUESTION_TYPE_LABEL[question.type]}</span>
                  <span className="rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-500/30">+{marks.correct}</span>
                  <span className="rounded-md bg-red-50 dark:bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-500/30">{marks.incorrect}</span>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-xs sm:p-6">
                <p className="text-base leading-relaxed font-medium text-fg sm:text-[17px]">{question.text}</p>

                <div className="mt-6">
                  {question.type === "numerical" ? (
                    <NumericInput
                      id={`num-${question.id}`}
                      value={current?.value ?? ""}
                      onChange={(v) => setResponse({ value: v })}
                      allowNegative={question.numerical?.allowNegative ?? false}
                      precision={question.numerical?.precision ?? 0}
                      error={error}
                    />
                  ) : (
                    <fieldset>
                      <legend className="mb-3 text-sm font-semibold text-slate-500">
                        {question.type === "multi" ? "Select one or more correct options" : "Select one option"}
                      </legend>
                      <div className="space-y-2.5">
                        {question.options.map((o, i) => {
                          const checked = current?.optionIds?.includes(o.id) ?? false;
                          return (
                            <label
                              key={o.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-colors",
                                checked ? "border-brand-500 bg-brand-50 dark:bg-brand-400/10" : "border-line hover:border-brand-200 dark:hover:border-brand-400/30 hover:bg-slate-50",
                              )}
                            >
                              <input
                                type={question.type === "multi" ? "checkbox" : "radio"}
                                name={`q-${question.id}`}
                                checked={checked}
                                onChange={() => {
                                  if (question.type === "single") setResponse({ optionIds: [o.id] });
                                  else {
                                    const prev = current?.optionIds ?? [];
                                    setResponse({ optionIds: checked ? prev.filter((x) => x !== o.id) : [...prev, o.id] });
                                  }
                                }}
                                className="mt-1 size-4 shrink-0 accent-brand-600"
                              />
                              <span className={cn("grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold", checked ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600")}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="pt-0.5 text-[15px] text-fg">{o.text}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                </div>

                {draft?.qid === question.id && (
                  <p className="mt-5 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100 ring-1 ring-amber-200 dark:ring-amber-500/30">
                    Unsaved selection — click <strong>Save &amp; Next</strong> or <strong>Mark for Review &amp; Next</strong> to keep it.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="shrink-0 border-t border-line bg-surface p-2.5 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.12)] sm:p-3 lg:shadow-none">
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button variant="outline" onClick={markAndNext} aria-label="Mark for Review & Next" className="border-violet-600 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10">
                <Bookmark /> <span className="sm:hidden">Review &amp; Next</span>
                <span className="hidden sm:inline">Mark for Review &amp; Next</span>
              </Button>
              <Button variant="secondary" onClick={clearResponse}>
                <Eraser /> Clear Response
              </Button>
              <div className="col-span-2 grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
                <Button variant="secondary" onClick={() => prevStop && goTo(prevStop.sectionId, prevStop.qid)} disabled={!prevStop}>
                  <ArrowLeft /> Back
                </Button>
                <Button onClick={saveAndNext} className="bg-q-answered hover:bg-emerald-700">
                  Save &amp; Next <ArrowRight />
                </Button>
              </div>
              <Button variant="dark" className="col-span-2 lg:hidden" onClick={() => setConfirmOpen(true)}>
                <Send /> Submit test
              </Button>
            </div>
          </div>
        </main>

        {/* Desktop palette */}
        <aside className="hidden w-80 shrink-0 border-l border-line bg-surface lg:flex lg:flex-col" aria-label="Question palette">
          <div className="min-h-0 flex-1">{palettePanel}</div>
        </aside>
      </div>

      <Drawer open={paletteOpen} onClose={() => setPaletteOpen(false)} title="Question palette" width="max-w-sm">
        {palettePanel}
      </Drawer>

      <SubmitDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => finish(false)} live={live} remaining={remaining} sectional={sectional} />

      <ConfirmDialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        onConfirm={() => router.push(`/tests/${testId}`)}
        title="Leave the exam?"
        description="Your saved answers are kept and the timer keeps running. You can resume from the test page before time runs out."
        confirmLabel="Leave exam"
        confirmVariant="secondary"
      />
    </div>
  );
}

function SubmitDialog({
  open,
  onClose,
  onConfirm,
  live,
  remaining,
  sectional,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  live: LiveExam;
  remaining: number;
  sectional: boolean;
}) {
  const rows = live.snapshot.sections.map((s) => ({ name: s.name, total: s.questions.length, ...countStates(s.questions.map((q) => stateOf(live, q))) }));
  const total = rows.reduce(
    (a, r) => ({
      total: a.total + r.total,
      answered: a.answered + r.answered,
      "not-answered": a["not-answered"] + r["not-answered"],
      review: a.review + r.review,
      "answered-review": a["answered-review"] + r["answered-review"],
      "not-visited": a["not-visited"] + r["not-visited"],
    }),
    { total: 0, answered: 0, "not-answered": 0, review: 0, "answered-review": 0, "not-visited": 0 },
  );
  const cols: { key: keyof typeof total; label: string; cls: string }[] = [
    { key: "answered", label: "Answered", cls: "text-emerald-700 dark:text-emerald-300" },
    { key: "not-answered", label: "Not answered", cls: "text-red-600 dark:text-red-400" },
    { key: "review", label: "Marked", cls: "text-violet-700 dark:text-violet-300" },
    { key: "answered-review", label: "Answered & marked", cls: "text-violet-700 dark:text-violet-300" },
    { key: "not-visited", label: "Not visited", cls: "text-slate-500" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Submit your test?"
      description={`${sectional ? "Current section" : "Time"} remaining: ${formatTimer(remaining)}. You cannot change answers after submitting.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Return to test
          </Button>
          <Button onClick={onConfirm}>
            <Send /> Submit test
          </Button>
        </>
      }
    >
      <div className="relative overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Section</th>
              <th className="px-3 py-2 text-center font-semibold">Questions</th>
              {cols.map((c) => (
                <th key={c.key} className="px-3 py-2 text-center font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-line">
                <td className="px-3 py-2.5 font-semibold text-fg">
                  {r.name}
                  {live.lockedSectionIds.some((id) => live.snapshot.sections.find((s) => s.id === id)?.name === r.name) && (
                    <span className="ml-1.5 text-[11px] font-medium text-slate-400">(time over)</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">{r.total}</td>
                {cols.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2.5 text-center font-bold", c.cls)}>
                    {r[c.key as keyof typeof r]}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length > 1 && (
              <tr className="border-t-2 border-line bg-slate-50 font-bold">
                <td className="px-3 py-2.5 text-fg">Total</td>
                <td className="px-3 py-2.5 text-center">{total.total}</td>
                {cols.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2.5 text-center", c.cls)}>
                    {total[c.key]}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-slate-500">Questions that are answered and marked for review will be evaluated. Unsaved selections are not counted.</p>
    </Modal>
  );
}
