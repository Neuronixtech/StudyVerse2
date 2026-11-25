"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CircleAlert,
  ClipboardList,
  Clock,
  FileQuestion,
  Gift,
  History,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trophy,
} from "lucide-react";
import { Breadcrumbs } from "@/components/page-banner";
import { UnlockPrompt } from "@/components/unlock-prompt";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/feedback";
import { attemptsFor, bestAttempt, testAccess } from "@/lib/access";
import {
  describeMultiRule,
  maxScoreOf,
  questionCount,
  questionTypesIn,
  QUESTION_TYPE_LABEL,
  totalDurationMin,
} from "@/lib/exam";
import { useSession } from "@/lib/hooks";
import { examName, subjectName } from "@/lib/mock/catalog";
import { liveKey } from "@/lib/store";
import { formatDateTime, formatDuration, percent } from "@/lib/utils";

export function TestDetail({ testId }: { testId: string }) {
  const { state, ready, learner, sub } = useSession();
  const test = state.tests.find((t) => t.id === testId);

  if (!test || !test.published) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<ClipboardList />}
          title="Test not available"
          description="This test doesn't exist or hasn't been published yet."
          action={<ButtonLink href="/tests">Browse tests</ButtonLink>}
        />
      </div>
    );
  }

  const attempts = attemptsFor(state, test.id, learner?.id);
  const best = bestAttempt(attempts);
  const access = testAccess(test, learner?.id ?? null, sub, attempts.length);
  const live = state.liveExams[liveKey(learner?.id ?? null, test.id)];
  const types = questionTypesIn(test);
  const linkedCourse = test.courseId ? state.courses.find((c) => c.id === test.courseId && c.status === "published") : undefined;
  const m = test.defaultMarks;

  return (
    <>
      <section className="border-b border-line bg-mist">
        <div className="container-page py-10">
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/tests", label: "Tests" }, { label: test.title }]} />
          <div className="mt-4 flex flex-wrap gap-2">
            {test.isDemo && (
              <Badge tone="brand" dot>
                Free demo · no sign-up
              </Badge>
            )}
            {test.examId && <Badge tone="sky">{examName(test.examId)}</Badge>}
            {test.subjectIds.map((s) => (
              <Badge key={s} tone="violet">
                {subjectName(s)}
              </Badge>
            ))}
            {test.timingMode === "sectional" && <Badge tone="amber">Section timers</Badge>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{test.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-500">{test.description}</p>
          <dl className="mt-6 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: <FileQuestion />, label: "Questions", value: questionCount(test) },
              { icon: <Timer />, label: "Duration", value: `${totalDurationMin(test)} min` },
              { icon: <Trophy />, label: "Maximum marks", value: maxScoreOf(test) },
              { icon: <RotateCcw />, label: "Attempts", value: test.attemptLimit === null ? "Unlimited" : `${test.attemptLimit} allowed` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-surface p-3.5">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-500 [&_svg]:size-3.5">
                  {s.icon} {s.label}
                </dt>
                <dd className="mt-1 text-lg font-extrabold text-fg">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="container-page grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          <Card>
            <CardHeader title="Sections" description={test.timingMode === "sectional" ? "Each section has its own timer and locks when its time ends." : `One overall timer of ${test.durationMin} minutes for the whole test.`} />
            <div className="relative overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Section</th>
                    <th className="px-5 py-2.5 font-semibold">Questions</th>
                    <th className="px-5 py-2.5 font-semibold">Question types</th>
                    {test.timingMode === "sectional" && <th className="px-5 py-2.5 font-semibold">Time</th>}
                  </tr>
                </thead>
                <tbody>
                  {test.sections.map((s) => {
                    const sTypes = [...new Set(s.questions.map((q) => q.type))];
                    return (
                      <tr key={s.id} className="border-t border-line">
                        <td className="px-5 py-3 font-semibold text-fg">{s.name}</td>
                        <td className="px-5 py-3">{s.questions.length}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {sTypes.map((t) => (
                              <Badge key={t} size="xs" tone="slate">
                                {QUESTION_TYPE_LABEL[t]}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        {test.timingMode === "sectional" && <td className="px-5 py-3">{s.durationMin} min</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Marking scheme" description="Shown again on the instructions screen before you start." />
            <ul className="divide-y divide-line text-sm">
              {types.includes("single") && (
                <li className="flex items-start gap-3 px-5 py-3.5">
                  <ListChecks className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                  <span>
                    <strong className="text-fg">Single correct:</strong> +{m.correct} for a correct answer, {m.incorrect} for an incorrect answer, {m.unattempted} if not attempted.
                  </span>
                </li>
              )}
              {types.includes("multi") && (
                <li className="flex items-start gap-3 px-5 py-3.5">
                  <ListChecks className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                  <span>
                    <strong className="text-fg">Multi-select:</strong> {describeMultiRule(test.multiMarking, m)}
                  </span>
                </li>
              )}
              {types.includes("numerical") && (
                <li className="flex items-start gap-3 px-5 py-3.5">
                  <ListChecks className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                  <span>
                    <strong className="text-fg">Numerical answer:</strong> +{m.correct} if within the accepted tolerance, {m.incorrect} otherwise. Enter values using the on-screen keypad.
                  </span>
                </li>
              )}
              <li className="flex items-start gap-3 px-5 py-3.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <span>
                  <strong className="text-fg">Results:</strong>{" "}
                  {test.resultRelease === "immediate"
                    ? "Score and detailed solutions are shown immediately after submission."
                    : test.solutionsReleased
                      ? "Score is shown immediately. Detailed solutions have been released."
                      : "Score is shown immediately. Detailed solutions are released later by the StudyVerse team."}
                </span>
              </li>
            </ul>
          </Card>

          {learner && attempts.length > 0 && (
            <Card>
              <CardHeader
                title="Your attempts"
                description={best ? `Best score: ${best.result.score}/${best.result.maxScore}` : undefined}
                action={
                  <ButtonLink href="/dashboard/attempts" variant="ghost" size="sm">
                    <History /> All history
                  </ButtonLink>
                }
              />
              <ul className="divide-y divide-line">
                {attempts.map((a, i) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                    <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">#{attempts.length - i}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-fg">
                        {a.result.score}/{a.result.maxScore}
                        <span className="ml-2 text-xs font-medium text-slate-500">({percent(Math.max(0, a.result.score), a.result.maxScore)}%)</span>
                        {a.id === best?.id && (
                          <Badge tone="amber" size="xs" className="ml-2">
                            <Trophy /> Best
                          </Badge>
                        )}
                        {a.snapshot.version !== test.version && (
                          <Badge tone="slate" size="xs" className="ml-2">
                            v{a.snapshot.version}
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(a.submittedAt)} · {formatDuration(a.timeTakenSec)}
                        {a.autoSubmitted && " · auto-submitted"}
                      </p>
                    </div>
                    <ButtonLink href={`/results/${a.id}`} variant="secondary" size="sm">
                      View result
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card lg:sticky lg:top-24">
            {!ready ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : access.allowed ? (
              <>
                <p className="flex items-center gap-2 text-base font-bold text-fg">
                  {test.isDemo ? <Gift className="size-5 text-brand-600 dark:text-brand-400" /> : <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />}
                  {test.isDemo ? "Free for everyone" : "Included in your subscription"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {test.attemptLimit !== null
                    ? `${test.attemptLimit - attempts.length} of ${test.attemptLimit} attempts remaining.`
                    : "Unlimited attempts. Every attempt is saved with the exact questions used."}
                </p>
                {live ? (
                  <>
                    <Callout tone="warning" className="mt-4" title="Attempt in progress">
                      You have an unfinished attempt. The timer kept running while you were away.
                    </Callout>
                    <ButtonLink href={`/exam/${test.id}/live`} block size="lg" className="mt-4">
                      Resume attempt <ArrowRight />
                    </ButtonLink>
                  </>
                ) : (
                  <ButtonLink href={`/exam/${test.id}`} block size="lg" className="mt-5">
                    {attempts.length ? "Attempt again" : "Start test"} <ArrowRight />
                  </ButtonLink>
                )}
                {!learner && test.isDemo && (
                  <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
                    <CircleAlert className="mt-px size-3.5 shrink-0" />
                    You&apos;ll see your result immediately. Sign in afterwards to save it to your history.
                  </p>
                )}
              </>
            ) : access.reason === "limit" ? (
              <Callout tone="warning" title="Attempt limit reached">
                You&apos;ve used all {test.attemptLimit} attempts for this test. Review your past results below.
              </Callout>
            ) : (
              <UnlockPrompt learner={learner} sub={sub} next={`/tests/${test.id}`} what="this test" className="border-0 p-0" />
            )}
            <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-slate-400" /> {test.timingMode === "sectional" ? "Independent section timers" : "Single countdown timer"}
              </li>
              <li className="flex items-center gap-2">
                <ListChecks className="size-4 text-slate-400" /> {types.map((t) => QUESTION_TYPE_LABEL[t]).join(", ")}
              </li>
            </ul>
          </div>

          {linkedCourse && (
            <Link href={`/courses/${linkedCourse.slug}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card hover:border-brand-300">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300">
                <BookOpen className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-slate-500">Linked course</span>
                <span className="block truncate text-sm font-bold text-fg">{linkedCourse.title}</span>
              </span>
            </Link>
          )}
        </aside>
      </div>
    </>
  );
}
