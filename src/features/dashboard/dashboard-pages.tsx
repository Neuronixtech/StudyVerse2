"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  CircleCheck,
  CirclePlay,
  ClipboardList,
  CreditCard,
  Gift,
  History,
  LogOut,
  Plus,
  Target,
  TimerOff,
  Trophy,
} from "lucide-react";
import { CourseThumb } from "@/components/course-visuals";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardHeader, EmptyState, PageHeader, ProgressBar, SimulatedNote, StatCard } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { allLessons, bestAttempt, courseProgress, demoTest, publishedCourses } from "@/lib/access";
import { useSession } from "@/lib/hooks";
import { EXAMS, examName } from "@/lib/mock/catalog";
import { logoutLearner, updateLearner } from "@/lib/store";
import type { Attempt, ExamId, Learner } from "@/lib/types";
import { cn, formatClock, formatDate, formatDateTime, formatDuration, formatINR, greetingFor, isValidEmail, isValidIndianPhone, percent, relativeTime } from "@/lib/utils";
import { StatusIcon, SubscriptionCard } from "./subscription-card";

/* ------------------------------ Overview ------------------------------ */

export function DashboardOverview() {
  const { state, learner, sub, now } = useSession();
  if (!learner) return null;

  const myAttempts = state.attempts.filter((a) => a.learnerId === learner.id).sort((a, b) => b.submittedAt - a.submittedAt);
  const started = publishedCourses(state)
    .map((c) => ({ course: c, progress: courseProgress(state, learner.id, c) }))
    .filter((x) => x.progress.started)
    .sort((a, b) => (b.progress.last?.updatedAt ?? 0) - (a.progress.last?.updatedAt ?? 0));
  const resume = started[0];
  const lessonsDone = state.progress.filter((p) => p.learnerId === learner.id && p.completed).length;
  const bestPct = myAttempts.length ? Math.max(...myAttempts.map((a) => percent(Math.max(0, a.result.score), a.result.maxScore))) : 0;
  const demo = demoTest(state);
  const triedDemo = demo && myAttempts.some((a) => a.testId === demo.id);
  const resumeEntry = resume?.progress.resumeLesson ? state.progress.find((p) => p.learnerId === learner.id && p.lessonId === resume.progress.resumeLesson!.id) : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greetingFor(now)}, ${learner.name.split(" ")[0]}`}
        description={`Preparing for ${examName(learner.targetExam)} ${learner.targetYear}. Here's where you left off.`}
        actions={
          <ButtonLink href="/courses" variant="secondary">
            <BookOpen /> Browse courses
          </ButtonLink>
        }
      />

      <SubscriptionCard sub={sub} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Lessons completed" value={lessonsDone} icon={<CircleCheck />} />
        <StatCard label="Courses in progress" value={started.length} icon={<BookOpen />} tone="violet" />
        <StatCard label="Tests attempted" value={myAttempts.length} icon={<ClipboardList />} tone="sky" />
        <StatCard label="Best test score" value={myAttempts.length ? `${bestPct}%` : "—"} icon={<Trophy />} tone="amber" />
      </div>

      {resume && resume.progress.resumeLesson ? (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr]">
            <CourseThumb theme={resume.course.theme} subjectIds={resume.course.subjectIds} className="aspect-video sm:aspect-auto sm:h-full" />
            <div className="p-5 sm:p-6">
              <p className="text-xs font-bold tracking-wide text-brand-700 dark:text-brand-300 uppercase">Continue learning</p>
              <h2 className="mt-1 text-lg font-extrabold">{resume.progress.resumeLesson.title}</h2>
              <p className="text-sm text-slate-500">{resume.course.title}</p>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500">
                  <span>
                    {resume.progress.completed} of {resume.progress.total} lessons watched
                  </span>
                  <span className="text-brand-700 dark:text-brand-300">{resume.progress.percent}%</span>
                </div>
                <ProgressBar value={resume.progress.percent} label="Course progress" />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <ButtonLink href={`/learn/${resume.course.slug}/${resume.progress.resumeLesson.id}`}>
                  <CirclePlay /> {resumeEntry && !resumeEntry.completed && resumeEntry.positionSec > 15 ? `Resume at ${formatClock(resumeEntry.positionSec)}` : "Start lesson"}
                </ButtonLink>
                {resume.progress.last && <span className="text-xs text-slate-500">Last watched {relativeTime(resume.progress.last.updatedAt, now)}</span>}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<CirclePlay />}
          title="Start your first lesson"
          description="Every course has a free preview lesson. Pick a course to begin."
          action={<ButtonLink href="/courses">Explore courses</ButtonLink>}
        />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="My courses"
            action={
              <Link href="/dashboard/courses" className="text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">
                View all
              </Link>
            }
          />
          {started.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No courses started yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {started.slice(0, 4).map(({ course, progress }) => (
                <li key={course.id}>
                  <Link href={`/courses/${course.slug}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
                    <CourseThumb theme={course.theme} subjectIds={course.subjectIds} size="sm" className="size-12 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-fg">{course.title}</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <ProgressBar value={progress.percent} size="sm" className="flex-1" label={`${course.title} progress`} />
                        <span className="text-xs font-semibold text-slate-500">{progress.percent}%</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent test attempts"
            action={
              <Link href="/dashboard/attempts" className="text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">
                View history
              </Link>
            }
          />
          {myAttempts.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-slate-500">You haven&apos;t taken any tests yet.</p>
              {demo && (
                <ButtonLink href={`/exam/${demo.id}`} size="sm" className="mt-3">
                  <Gift /> Try the free demo
                </ButtonLink>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {myAttempts.slice(0, 4).map((a) => (
                <AttemptRow key={a.id} attempt={a} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {demo && !triedDemo && (
        <Callout tone="brand" icon={<Gift />} title="Haven't tried the exam interface yet?" action={<ButtonLink href={`/exam/${demo.id}`} size="sm">Start free demo</ButtonLink>}>
          The free demo covers all three question types and shows your score instantly.
        </Callout>
      )}
    </div>
  );
}

function AttemptRow({ attempt }: { attempt: Attempt }) {
  const pct = percent(Math.max(0, attempt.result.score), attempt.result.maxScore);
  return (
    <li>
      <Link href={`/results/${attempt.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl text-sm font-extrabold", pct >= 70 ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : pct >= 40 ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400")}>
          {pct}%
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg">{attempt.snapshot.title}</p>
          <p className="text-xs text-slate-500">
            {attempt.result.score}/{attempt.result.maxScore} · {formatDate(attempt.submittedAt)}
          </p>
        </div>
        <ArrowRight className="size-4 text-slate-300" />
      </Link>
    </li>
  );
}

/* ------------------------------ My courses ------------------------------ */

export function MyCourses() {
  const { state, learner, sub } = useSession();
  const [tab, setTab] = useState<"progress" | "completed" | "available">("progress");
  if (!learner) return null;

  const rows = publishedCourses(state).map((c) => ({ course: c, progress: courseProgress(state, learner.id, c) }));
  const inProgress = rows.filter((r) => r.progress.started && r.progress.completed < r.progress.total);
  const completed = rows.filter((r) => r.progress.total > 0 && r.progress.completed === r.progress.total);
  const available = rows.filter((r) => !r.progress.started);
  const list = tab === "progress" ? inProgress : tab === "completed" ? completed : available;

  // Archived courses with progress remain visible in history
  const archived = state.courses.filter((c) => c.status === "archived" && courseProgress(state, learner.id, c).started);

  return (
    <div className="space-y-6">
      <PageHeader title="My courses" description="Track progress across every course you've started." />
      <Tabs
        label="Course filter"
        value={tab}
        onChange={setTab}
        items={[
          { value: "progress", label: "In progress", count: inProgress.length },
          { value: "completed", label: "Completed", count: completed.length },
          { value: "available", label: "Not started", count: available.length },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title={tab === "completed" ? "No completed courses yet" : tab === "progress" ? "No courses in progress" : "You've started every course!"}
          description={tab === "progress" ? "Open any course and play its first lesson to start tracking progress." : undefined}
          action={<ButtonLink href="/courses">Browse catalog</ButtonLink>}
        />
      ) : (
        <ul className="space-y-4">
          {list.map(({ course, progress }) => {
            const lessons = allLessons(course);
            const next = progress.resumeLesson ?? lessons[0];
            const canPlay = sub.status === "active" || next?.isPreview;
            return (
              <li key={course.id}>
                <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <CourseThumb theme={course.theme} subjectIds={course.subjectIds} className="aspect-video w-full shrink-0 rounded-xl sm:w-44" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/courses/${course.slug}`} className="text-base font-bold text-fg hover:text-brand-700 dark:hover:text-brand-300">
                      {course.title}
                    </Link>
                    <p className="text-sm text-slate-500">{course.instructor.name}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <ProgressBar value={progress.percent} className="flex-1" label={`${course.title} progress`} />
                      <span className="text-xs font-bold text-slate-600">
                        {progress.completed}/{progress.total}
                      </span>
                    </div>
                    {next && tab !== "completed" && <p className="mt-2 text-xs text-slate-500">Next: {next.title}</p>}
                  </div>
                  <div className="shrink-0">
                    {tab === "completed" ? (
                      <Badge tone="green">
                        <CircleCheck /> Completed
                      </Badge>
                    ) : next && canPlay ? (
                      <ButtonLink href={`/learn/${course.slug}/${next.id}`} size="sm">
                        <CirclePlay /> {progress.started ? "Continue" : "Start"}
                      </ButtonLink>
                    ) : (
                      <ButtonLink href={`/courses/${course.slug}`} size="sm" variant="secondary">
                        View course
                      </ButtonLink>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      {archived.length > 0 && (
        <Callout tone="info" title="Archived courses in your history">
          {archived.map((c) => c.title).join(", ")} — archived by StudyVerse. Your progress is preserved.
        </Callout>
      )}
    </div>
  );
}

/* ------------------------------ Attempts ------------------------------ */

export function AttemptHistory() {
  const { state, learner } = useSession();
  const [testFilter, setTestFilter] = useState("all");
  const mine = useMemo(() => state.attempts.filter((a) => a.learnerId === learner?.id).sort((a, b) => b.submittedAt - a.submittedAt), [state.attempts, learner?.id]);
  if (!learner) return null;

  const byTest = new Map<string, Attempt[]>();
  mine.forEach((a) => byTest.set(a.testId, [...(byTest.get(a.testId) ?? []), a]));
  const visible = testFilter === "all" ? mine : mine.filter((a) => a.testId === testFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attempt history"
        description="Every submitted attempt keeps the exact questions, answers and marking rules used at the time."
        actions={
          <ButtonLink href="/tests" variant="secondary">
            <ClipboardList /> Find a test
          </ButtonLink>
        }
      />

      {mine.length === 0 ? (
        <EmptyState icon={<History />} title="No attempts yet" description="Your submitted tests will appear here with scores and review links." action={<ButtonLink href="/tests">Browse tests</ButtonLink>} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...byTest.entries()].map(([testId, list]) => {
              const best = bestAttempt(list)!;
              return (
                <Card key={testId} className="p-4">
                  <p className="truncate text-sm font-bold text-fg">{list[0].snapshot.title}</p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Best score</p>
                      <p className="text-xl font-extrabold text-fg">
                        {best.result.score}
                        <span className="text-sm font-semibold text-slate-400">/{best.result.maxScore}</span>
                      </p>
                    </div>
                    <Badge tone="slate">
                      {list.length} attempt{list.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader
              title="All attempts"
              action={
                <div className="w-56">
                  <Select value={testFilter} onChange={(e) => setTestFilter(e.target.value)} aria-label="Filter by test">
                    <option value="all">All tests</option>
                    {[...byTest.entries()].map(([id, list]) => (
                      <option key={id} value={id}>
                        {list[0].snapshot.title}
                      </option>
                    ))}
                  </Select>
                </div>
              }
            />
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-semibold">Test</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Submitted</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Score</th>
                    <th className="px-3 py-2.5 text-left font-semibold">C / I / U</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Time</th>
                    <th className="px-5 py-2.5 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((a) => {
                    const best = bestAttempt(byTest.get(a.testId) ?? []);
                    return (
                      <tr key={a.id} className="border-t border-line">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-fg">{a.snapshot.title}</p>
                          <p className="flex items-center gap-2 text-xs text-slate-500">
                            v{a.snapshot.version}
                            {a.autoSubmitted && (
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                                <TimerOff className="size-3" /> auto-submitted
                              </span>
                            )}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{formatDateTime(a.submittedAt)}</td>
                        <td className="px-3 py-3">
                          <span className="font-bold text-fg">
                            {a.result.score}/{a.result.maxScore}
                          </span>
                          {best?.id === a.id && (byTest.get(a.testId)?.length ?? 0) > 1 && (
                            <Badge tone="amber" size="xs" className="ml-2">
                              <Trophy /> Best
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          <span className="text-emerald-700 dark:text-emerald-300">{a.result.correct + a.result.partial}</span> / <span className="text-red-600 dark:text-red-400">{a.result.incorrect}</span> / <span className="text-slate-500">{a.result.unattempted}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{formatDuration(a.timeTakenSec)}</td>
                        <td className="px-5 py-3 text-right">
                          <ButtonLink href={`/results/${a.id}`} size="xs" variant="secondary">
                            Result
                          </ButtonLink>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ---------------------------- Subscription ---------------------------- */

export function MySubscription() {
  const { state, learner, sub } = useSession();
  if (!learner) return null;
  const adminName = (id?: string) => state.admins.find((a) => a.id === id)?.name ?? "Admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription"
        description="Your plan status, activation requests and subscription periods."
        actions={
          sub.pending ? (
            <Button disabled title="You already have a pending request">
              <Plus /> New request
            </Button>
          ) : (
            <ButtonLink href="/subscribe">
              <Plus /> {sub.status === "active" ? "Extend plan" : "New request"}
            </ButtonLink>
          )
        }
      />
      <SubscriptionCard sub={sub} compact />

      <Card>
        <CardHeader title="Activation requests" description="Only one request can be pending at a time." />
        {sub.requests.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <CreditCard className="mx-auto size-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">You haven&apos;t submitted any activation requests.</p>
            <ButtonLink href="/subscribe" size="sm" className="mt-4">
              Choose a plan
            </ButtonLink>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {sub.requests.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <StatusIcon status={r.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-fg">
                      {r.planDays}-day plan · {formatINR(r.amount)} via {r.method === "upi" ? "UPI" : "bank transfer"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Ref <span className="font-mono">{r.reference}</span> · submitted {formatDateTime(r.submittedAt)}
                      {r.screenshotName && <> · screenshot: {r.screenshotName}</>}
                    </p>
                    {r.status === "approved" && r.reviewedAt && (
                      <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                        Approved for {r.approvedDays} days by {adminName(r.reviewedBy)} on {formatDate(r.reviewedAt)}
                      </p>
                    )}
                    {r.status === "rejected" && (
                      <p className="mt-2 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-800 dark:text-red-200 ring-1 ring-red-200 dark:ring-red-500/30">
                        <strong>Rejected:</strong> {r.rejectionReason}
                      </p>
                    )}
                  </div>
                  <Badge tone={r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "amber"} dot>
                    {r.status[0].toUpperCase() + r.status.slice(1)}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {sub.periods.length > 0 && (
        <Card>
          <CardHeader title="Subscription periods" description="Renewals extend your expiry date instead of replacing it." />
          <ol className="relative space-y-5 px-5 py-5">
            {[...sub.periods].reverse().map((p) => (
              <li key={p.id} className="flex gap-4">
                <span className="mt-1 size-3 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-100 dark:ring-brand-400/20" />
                <div>
                  <p className="text-sm font-bold text-fg">{p.days} days</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(p.startsAt)} → {formatDate(p.expiresAt)} · activated {formatDate(p.activatedAt)} by {adminName(p.activatedBy)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------ Profile ------------------------------ */

export function ProfileSettings() {
  const { learner } = useSession();
  if (!learner) return null;
  // Keyed so the form resets when the prototype persona changes
  return <ProfileForm key={learner.id} learner={learner} />;
}

function ProfileForm({ learner }: { learner: Learner }) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({
    name: learner.name,
    email: learner.email,
    phone: learner.phone,
    city: learner.city,
    targetExam: learner.targetExam,
    targetYear: String(learner.targetYear),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [logoutOpen, setLogoutOpen] = useState(false);

  const dirty =
    form.name !== learner.name || form.email !== learner.email || form.phone !== learner.phone || form.city !== learner.city || form.targetExam !== learner.targetExam || form.targetYear !== String(learner.targetYear);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Enter your full name";
    if (!isValidEmail(form.email)) errs.email = "Enter a valid email";
    if (!isValidIndianPhone(form.phone)) errs.phone = "Enter a valid 10-digit mobile number";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    updateLearner(learner.id, { ...form, name: form.name.trim(), targetYear: Number(form.targetYear) });
    toast({ title: "Profile updated", simulated: true });
  };

  const changePw = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pw.current) errs.current = "Enter your current password";
    if (pw.next.length < 8) errs.next = "Use at least 8 characters";
    if (pw.confirm !== pw.next) errs.confirm = "Passwords don't match";
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setPw({ current: "", next: "", confirm: "" });
    toast({ title: "Password changed", description: "No real credentials exist in the prototype.", simulated: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & settings" description="Manage your personal details and account security." />
      <Card>
        <CardHeader title="Personal details" />
        <form onSubmit={save} noValidate className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" error={errors.name} required>
              {(p) => <Input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            </Field>
            <Field label="Email" error={errors.email} required>
              {(p) => <Input {...p} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
            </Field>
            <Field label="Mobile number" error={errors.phone} required>
              {(p) => <Input {...p} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}
            </Field>
            <Field label="City">
              {(p) => <Input {...p} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Pune" />}
            </Field>
            <Field label="Preparing for">
              {(p) => (
                <Select {...p} value={form.targetExam} onChange={(e) => setForm({ ...form, targetExam: e.target.value as ExamId })}>
                  {EXAMS.filter((x) => !x.comingSoon).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Exam year">
              {(p) => (
                <Select {...p} value={form.targetYear} onChange={(e) => setForm({ ...form, targetYear: e.target.value })}>
                  {["2027", "2028", "2029"].map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <SimulatedNote>Saved to this browser only.</SimulatedNote>
            <Button type="submit" disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Change password" />
        <form onSubmit={changePw} noValidate className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <Field label="Current password" error={pwErrors.current}>
            {(p) => <Input {...p} type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />}
          </Field>
          <Field label="New password" error={pwErrors.next}>
            {(p) => <Input {...p} type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />}
          </Field>
          <Field label="Confirm new password" error={pwErrors.confirm}>
            {(p) => <Input {...p} type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />}
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary">
              <Target /> Update password
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Account" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-fg">Member since {formatDate(learner.joinedAt)}</p>
            <p className="text-xs text-slate-500">Account deletion and data-retention policy are still to be decided, so deletion isn&apos;t available in the prototype.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled title="Not available in the prototype">
              Delete account
            </Button>
            <Button variant="danger" onClick={() => setLogoutOpen(true)}>
              <LogOut /> Log out
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          logoutLearner();
          setLogoutOpen(false);
          toast({ title: "Signed out", simulated: true });
          router.push("/");
        }}
        title="Log out of StudyVerse?"
        confirmLabel="Log out"
        tone="danger"
      />
    </div>
  );
}
