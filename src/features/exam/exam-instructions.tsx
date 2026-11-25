"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, ClipboardList, Clock, FlaskConical, Info, Keyboard, Timer } from "lucide-react";
import { UnlockPrompt } from "@/components/unlock-prompt";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, EmptyState, Skeleton } from "@/components/ui/feedback";
import { attemptsFor, testAccess } from "@/lib/access";
import {
  describeMultiRule,
  maxScoreOf,
  questionCount,
  questionTypesIn,
  QUESTION_TYPE_LABEL,
  totalDurationMin,
} from "@/lib/exam";
import { useSession } from "@/lib/hooks";
import { liveKey, startLiveExam } from "@/lib/store";
import { ExamHeader } from "./exam-header";
import { PaletteCell } from "./palette";

export function ExamInstructions({ testId }: { testId: string }) {
  const router = useRouter();
  const { state, ready, learner, sub } = useSession();
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState(false);
  const test = state.tests.find((t) => t.id === testId);

  if (!test || !test.published) {
    return (
      <div className="container-page py-20">
        <EmptyState icon={<ClipboardList />} title="Test not available" action={<ButtonLink href="/tests">Back to tests</ButtonLink>} />
      </div>
    );
  }

  const candidate = learner?.name ?? "Guest candidate";
  const attempts = attemptsFor(state, test.id, learner?.id);
  const access = testAccess(test, learner?.id ?? null, sub, attempts.length);
  const live = state.liveExams[liveKey(learner?.id ?? null, test.id)];
  const types = questionTypesIn(test);
  const m = test.defaultMarks;
  const sectional = test.timingMode === "sectional";

  const begin = () => {
    setTouched(true);
    if (!agreed) return;
    if (!live) startLiveExam(test, learner?.id ?? null);
    router.push(`/exam/${test.id}/live`);
  };

  return (
    <>
      <ExamHeader title={test.title} candidate={candidate} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-6 sm:px-5 sm:py-8">
        <Link href={`/tests/${test.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-fg">
          <ArrowLeft className="size-4" /> Back to test details
        </Link>

        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="border-b border-line bg-slate-50 px-5 py-4 sm:px-8">
            <h1 className="text-xl font-extrabold sm:text-2xl">General instructions</h1>
            <p className="mt-1 text-sm text-slate-500">Please read the instructions carefully before starting the test.</p>
          </div>

          <div className="space-y-8 px-5 py-6 sm:px-8">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total duration", value: `${totalDurationMin(test)} minutes`, icon: <Clock /> },
                { label: "Timing", value: sectional ? "Per-section timers" : "One overall timer", icon: <Timer /> },
                { label: "Questions", value: questionCount(test), icon: <ClipboardList /> },
                { label: "Maximum marks", value: maxScoreOf(test), icon: <Info /> },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-brand-50/70 dark:bg-brand-400/10 p-3.5">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-brand-800 dark:text-brand-200 [&_svg]:size-3.5">
                    {s.icon} {s.label}
                  </dt>
                  <dd className="mt-1 text-base font-extrabold text-fg">{s.value}</dd>
                </div>
              ))}
            </dl>

            <section>
              <h2 className="text-base font-bold">1. Sections</h2>
              <div className="relative mt-3 overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Section</th>
                      <th className="px-4 py-2 font-semibold">Questions</th>
                      <th className="px-4 py-2 font-semibold">Types</th>
                      {sectional && <th className="px-4 py-2 font-semibold">Time allowed</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {test.sections.map((s) => (
                      <tr key={s.id} className="border-t border-line">
                        <td className="px-4 py-2.5 font-semibold text-fg">{s.name}</td>
                        <td className="px-4 py-2.5">{s.questions.length}</td>
                        <td className="px-4 py-2.5 text-slate-600">{[...new Set(s.questions.map((q) => QUESTION_TYPE_LABEL[q.type]))].join(", ")}</td>
                        {sectional && <td className="px-4 py-2.5">{s.durationMin} min</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-base font-bold">2. Timer</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                {sectional ? (
                  <>
                    <li>Each section has its own countdown, shown at the top right. A section&apos;s timer runs only while you are working in that section.</li>
                    <li>When a section&apos;s timer reaches zero, that section is locked and cannot be revisited. You continue with the sections that still have time.</li>
                    <li>The test is submitted automatically when the time for every section has run out.</li>
                  </>
                ) : (
                  <>
                    <li>The countdown timer at the top right shows the time remaining for the whole test.</li>
                    <li>When the timer reaches zero, the test is submitted automatically — you don&apos;t need to click Submit.</li>
                  </>
                )}
                <li>Refreshing or closing the page does not pause the timer. Your saved answers are kept and you can resume.</li>
              </ul>
              {sectional && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 ring-1 ring-amber-200 dark:ring-amber-500/30">
                  <FlaskConical className="mt-px size-3.5 shrink-0" />
                  Prototype default for section-timer expiry. The final policy (including whether completed sections can be revisited) is still to be confirmed.
                </p>
              )}
            </section>

            <section>
              <h2 className="text-base font-bold">3. Marking scheme</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {types.includes("single") && (
                  <div className="rounded-xl border border-line p-4">
                    <Badge tone="brand" size="xs">
                      Single correct
                    </Badge>
                    <p className="mt-2 text-sm">
                      Correct <strong className="text-emerald-600 dark:text-emerald-400">+{m.correct}</strong> · Incorrect <strong className="text-red-600 dark:text-red-400">{m.incorrect}</strong> · Unattempted <strong>{m.unattempted}</strong>
                    </p>
                  </div>
                )}
                {types.includes("multi") && (
                  <div className="rounded-xl border border-line p-4">
                    <Badge tone="violet" size="xs">
                      Multi-select
                    </Badge>
                    <p className="mt-2 text-sm leading-relaxed">{describeMultiRule(test.multiMarking, m)}</p>
                  </div>
                )}
                {types.includes("numerical") && (
                  <div className="rounded-xl border border-line p-4">
                    <Badge tone="amber" size="xs">
                      Numerical
                    </Badge>
                    <p className="mt-2 text-sm leading-relaxed">
                      Correct <strong className="text-emerald-600 dark:text-emerald-400">+{m.correct}</strong> · Incorrect <strong className="text-red-600 dark:text-red-400">{m.incorrect}</strong>. Answers within the stated precision are accepted.
                    </p>
                  </div>
                )}
              </div>
              {m.incorrect < 0 ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
                  <CircleAlert className="size-4" /> This test has negative marking.
                </p>
              ) : (
                <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">There is no negative marking in this test.</p>
              )}
            </section>

            <section>
              <h2 className="text-base font-bold">4. Question palette</h2>
              <p className="mt-2 text-sm">The palette on the right of the screen shows the status of each question using the symbols below:</p>
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { s: "not-visited" as const, t: "You have not visited the question yet." },
                  { s: "not-answered" as const, t: "You have visited but not answered the question." },
                  { s: "answered" as const, t: "You have answered the question." },
                  { s: "review" as const, t: "Not answered, but marked for review." },
                  { s: "answered-review" as const, t: "Answered and marked for review — this answer will be evaluated." },
                ].map((l, i) => (
                  <li key={l.s} className="flex items-center gap-3 text-sm">
                    <PaletteCell state={l.s} label={i + 1} />
                    {l.t}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold">5. Answering and navigating</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                <li>
                  Selecting an option does <strong>not</strong> save it. Click <strong>Save &amp; Next</strong> to save your answer and move to the next question.
                </li>
                <li>
                  <strong>Mark for Review &amp; Next</strong> saves any selected answer, flags the question for review and moves on.
                </li>
                <li>
                  <strong>Clear Response</strong> removes the saved answer for the current question.
                </li>
                <li>
                  Click a question number in the palette to jump directly to it. Moving away without saving discards the unsaved selection.
                </li>
                {types.includes("multi") && <li>For multi-select questions, one or more options may be correct.</li>}
                {types.includes("numerical") && <li>For numerical questions, type your answer or use the on-screen keypad.</li>}
              </ul>
              <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <Keyboard className="size-4" /> All controls work with the keyboard (Tab, Space and Enter).
              </p>
            </section>
          </div>

          <div className="border-t border-line bg-slate-50 px-5 py-5 sm:px-8">
            {!ready ? (
              <Skeleton className="h-12 w-full" />
            ) : !access.allowed ? (
              access.reason === "limit" ? (
                <Callout tone="warning" title="Attempt limit reached">
                  You&apos;ve used all {test.attemptLimit} attempts for this test.
                </Callout>
              ) : (
                <UnlockPrompt learner={learner} sub={sub} next={`/exam/${test.id}`} what="this test" />
              )
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      aria-invalid={touched && !agreed ? true : undefined}
                      aria-describedby={touched && !agreed ? "ack-error" : undefined}
                      className="mt-0.5 size-5 shrink-0 accent-brand-600"
                    />
                    <span className="font-medium text-fg">
                      I have read the instructions. I understand the marking scheme and that the test is submitted automatically when time runs out.
                    </span>
                  </label>
                  {touched && !agreed && (
                    <p id="ack-error" className="mt-2 ml-8 text-xs font-semibold text-red-600 dark:text-red-400">
                      Please confirm you have read the instructions to begin.
                    </p>
                  )}
                  {!learner && test.isDemo && <p className="mt-2 ml-8 text-xs text-slate-500">You&apos;re attempting as a guest. Sign in after the test to save your result.</p>}
                </div>
                <Button size="lg" onClick={begin} className="shrink-0" aria-disabled={!agreed}>
                  {live ? "Resume test" : "I am ready to begin"} <ArrowRight />
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
