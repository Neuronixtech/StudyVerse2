"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  CircleMinus,
  CircleX,
  ClipboardList,
  Clock,
  History,
  Lock,
  RotateCcw,
  Save,
  Target,
  TimerOff,
  Trophy,
} from "lucide-react";
import { Breadcrumbs } from "@/components/page-banner";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { attemptsFor, bestAttempt, testAccess } from "@/lib/access";
import { useSession } from "@/lib/hooks";
import { claimAttempt } from "@/lib/store";
import { cn, formatDateTime, formatDuration, percent } from "@/lib/utils";

export function ScoreDonut({ score, max, size = 160 }: { score: number; max: number; size?: number }) {
  const pct = max > 0 ? Math.max(0, score) / max : 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Score ${score} out of ${max}`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 50 50)"
        className="text-brand-500 transition-[stroke-dasharray] duration-700"
      />
      <text x="50" y="47" textAnchor="middle" className="fill-ink text-[18px] font-extrabold">
        {score}
      </text>
      <text x="50" y="62" textAnchor="middle" className="fill-slate-400 text-[9px] font-semibold">
        out of {max}
      </text>
    </svg>
  );
}

export function ResultView({ attemptId }: { attemptId: string }) {
  const { state, ready, learner, sub } = useSession();
  const attempt = state.attempts.find((a) => a.id === attemptId);

  if (!ready) {
    return (
      <div className="container-page space-y-4 py-12">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="container-page py-20">
        <EmptyState icon={<ClipboardList />} title="Result not found" description="This attempt doesn't exist in this browser's prototype data." action={<ButtonLink href="/tests">Browse tests</ButtonLink>} />
      </div>
    );
  }

  if (attempt.learnerId && attempt.learnerId !== learner?.id) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<Lock />}
          title="This result belongs to another account"
          description="Sign in as the learner who took this test to view the result."
          action={<ButtonLink href={`/login?next=/results/${attempt.id}`}>Log in</ButtonLink>}
        />
      </div>
    );
  }

  const test = state.tests.find((t) => t.id === attempt.testId);
  const r = attempt.result;
  const attempted = r.correct + r.incorrect + r.partial;
  const accuracy = percent(r.correct + r.partial * 0.5, attempted);
  const solutionsAvailable = test ? test.resultRelease === "immediate" || test.solutionsReleased : false;
  const history = attemptsFor(state, attempt.testId, learner?.id);
  const best = bestAttempt(history);
  const canRetry = test ? testAccess(test, learner?.id ?? null, sub, history.length).allowed : false;
  const isGuest = attempt.learnerId === null;

  return (
    <>
      <section className="border-b border-line bg-mist">
        <div className="container-page py-8">
          <Breadcrumbs items={[{ href: "/tests", label: "Tests" }, ...(test ? [{ href: `/tests/${test.id}`, label: test.title }] : []), { label: "Result" }]} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{attempt.snapshot.title}</h1>
            {attempt.autoSubmitted && (
              <Badge tone="amber">
                <TimerOff /> Auto-submitted when time ran out
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Submitted {formatDateTime(attempt.submittedAt)} · Time taken {formatDuration(attempt.timeTakenSec)}
            {test && attempt.snapshot.version !== test.version && <> · Scored against version {attempt.snapshot.version} of this test</>}
          </p>
        </div>
      </section>

      <div className="container-page space-y-8 py-10">
        {isGuest && (
          <Callout
            tone="brand"
            icon={<Save />}
            title={learner ? "Save this result to your history" : "Want to keep this result?"}
            action={
              learner ? (
                <Button
                  size="sm"
                  onClick={() => {
                    claimAttempt(attempt.id, learner.id);
                    toast({ title: "Result saved to your history", simulated: true });
                  }}
                >
                  Save to my history
                </Button>
              ) : (
                <div className="flex gap-2">
                  <ButtonLink size="sm" href={`/signup?claim=${attempt.id}&next=/results/${attempt.id}`}>
                    Sign up free
                  </ButtonLink>
                  <ButtonLink size="sm" variant="secondary" href={`/login?claim=${attempt.id}&next=/results/${attempt.id}`}>
                    Log in
                  </ButtonLink>
                </div>
              )
            }
          >
            {learner ? "You took this demo as a guest. Attach it to your account to see it in your attempt history." : "You took the demo as a guest. Sign up or log in to save this result to your personal history."}
          </Callout>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
            <ScoreDonut score={r.score} max={r.maxScore} />
            <div className="w-full flex-1">
              <p className="text-sm font-semibold text-slate-500">Your score</p>
              <p className="text-4xl font-extrabold tracking-tight text-ink">
                {r.score}
                <span className="text-xl font-bold text-slate-400"> / {r.maxScore}</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">{percent(Math.max(0, r.score), r.maxScore)}% of maximum marks</p>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Target className="size-3.5" /> Accuracy
                  </dt>
                  <dd className="text-lg font-extrabold text-ink">{accuracy}%</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="size-3.5" /> Time taken
                  </dt>
                  <dd className="text-lg font-extrabold text-ink">{formatDuration(attempt.timeTakenSec)}</dd>
                </div>
              </dl>
              {best && history.length > 1 && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600">
                  <Trophy className="size-4 text-amber-500" />
                  {best.id === attempt.id ? "Your best score so far!" : `Best score: ${best.result.score}/${best.result.maxScore}`}
                </p>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Correct", value: r.correct, icon: <CircleCheck />, cls: "bg-emerald-50 text-emerald-700" },
              { label: "Incorrect", value: r.incorrect, icon: <CircleX />, cls: "bg-red-50 text-red-700" },
              { label: "Partially correct", value: r.partial, icon: <CircleMinus />, cls: "bg-amber-50 text-amber-700" },
              { label: "Unattempted", value: r.unattempted, icon: <CircleMinus />, cls: "bg-slate-100 text-slate-600" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-white p-5 shadow-card">
                <span className={cn("grid size-10 place-items-center rounded-xl [&_svg]:size-5", s.cls)}>{s.icon}</span>
                <p className="mt-3 text-3xl font-extrabold text-ink">{s.value}</p>
                <p className="text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader title="Section-wise breakdown" />
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 text-left font-semibold">Section</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Correct</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Incorrect</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Partial</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Unattempted</th>
                  <th className="px-5 py-2.5 text-left font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {r.sections.map((s) => (
                  <tr key={s.sectionId} className="border-t border-line">
                    <td className="px-5 py-3 font-semibold text-ink">{s.name}</td>
                    <td className="px-3 py-3 text-center font-semibold text-emerald-700">{s.correct}</td>
                    <td className="px-3 py-3 text-center font-semibold text-red-600">{s.incorrect}</td>
                    <td className="px-3 py-3 text-center font-semibold text-amber-700">{s.partial}</td>
                    <td className="px-3 py-3 text-center text-slate-500">{s.unattempted}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-14 font-bold text-ink">
                          {s.score}/{s.maxScore}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${percent(Math.max(0, s.score), s.maxScore)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          {solutionsAvailable ? (
            <Callout tone="success" title="Detailed solutions are available" action={<ButtonLink href={`/results/${attempt.id}/review`}>Review answers <ArrowRight /></ButtonLink>}>
              See every question with your response, the correct answer and an explanation.
            </Callout>
          ) : (
            <Callout tone="info" icon={<Lock />} title="Solutions not yet released">
              Your score is final. Detailed solutions and correct answers for this test will appear here once the StudyVerse team releases them.
            </Callout>
          )}
          <div className="flex flex-wrap gap-2">
            {test && canRetry && (
              <ButtonLink href={`/exam/${test.id}`} variant="secondary">
                <RotateCcw /> Attempt again
              </ButtonLink>
            )}
            {learner && (
              <ButtonLink href="/dashboard/attempts" variant="secondary">
                <History /> Attempt history
              </ButtonLink>
            )}
            <Link href="/tests" className="inline-flex items-center px-2 text-sm font-semibold text-brand-700 hover:underline">
              More tests
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
