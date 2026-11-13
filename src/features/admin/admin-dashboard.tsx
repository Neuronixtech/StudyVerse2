"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpen, ClipboardList, CreditCard, FilePen, Gift, Inbox, Lock, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar, Card, CardHeader, PageHeader, StatCard } from "@/components/ui/feedback";
import { getSubscription, hasPermission } from "@/lib/access";
import { useSession } from "@/lib/hooks";
import { cn, DAY, formatDate, formatINR, formatWeekday, greetingFor, relativeTime } from "@/lib/utils";
import { ReviewRequestDialog } from "./admin-subscriptions";

export function AdminDashboard() {
  const { state, admin, now } = useSession();
  const [reviewId, setReviewId] = useState<string | null>(null);
  if (!admin) return null;

  const subs = state.learners.map((l) => ({ learner: l, sub: getSubscription(state, l.id, now) }));
  const active = subs.filter((s) => s.sub.status === "active");
  const expiring = active.filter((s) => s.sub.daysLeft <= 7);
  const pending = state.requests.filter((r) => r.status === "pending").sort((a, b) => a.submittedAt - b.submittedAt);
  const published = state.courses.filter((c) => c.status === "published");
  const drafts = state.courses.filter((c) => c.status === "draft");
  const liveTests = state.tests.filter((t) => t.published);
  const hiddenTests = state.tests.filter((t) => !t.published);
  const demo = state.tests.find((t) => t.isDemo);
  const weekAttempts = state.attempts.filter((a) => now - a.submittedAt < 7 * DAY).length;
  const canSubs = hasPermission(admin, "subscriptions");

  // Last 14 days of attempts and sign-ups
  const startOfDay = (ms: number) => ms - (((ms + 5.5 * 3_600_000) % DAY) + DAY) % DAY;
  const today = startOfDay(now);
  const days = Array.from({ length: 14 }, (_, i) => today - (13 - i) * DAY);
  const series = days.map((d) => ({
    day: d,
    attempts: state.attempts.filter((a) => a.submittedAt >= d && a.submittedAt < d + DAY).length,
    signups: state.learners.filter((l) => l.joinedAt >= d && l.joinedAt < d + DAY).length,
  }));
  const peak = Math.max(1, ...series.map((s) => Math.max(s.attempts, s.signups)));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greetingFor(now)}, ${admin.name.split(" ")[0]}`}
        description={`${formatDate(now)} · Here's what needs your attention today.`}
        actions={
          canSubs && pending.length > 0 ? (
            <ButtonLink href="/admin/requests">
              <Inbox /> Review {pending.length} pending
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Learners" value={state.learners.length} icon={<Users />} hint={`${state.learners.filter((l) => now - l.joinedAt < 7 * DAY).length} joined this week`} />
        <StatCard label="Active subscriptions" value={active.length} icon={<CreditCard />} tone="emerald" hint={`${expiring.length} expiring in 7 days`} />
        <StatCard label="Pending requests" value={pending.length} icon={<Inbox />} tone="amber" hint={pending[0] ? `Oldest ${relativeTime(pending[0].submittedAt, now)}` : "All caught up"} />
        <StatCard label="Published courses" value={published.length} icon={<BookOpen />} tone="violet" hint={`${drafts.length} draft`} />
        <StatCard label="Published tests" value={liveTests.length} icon={<ClipboardList />} tone="sky" hint={`${hiddenTests.length} unpublished`} />
        <StatCard label="Attempts (7 days)" value={weekAttempts} icon={<FilePen />} tone="rose" hint={`${state.attempts.length} all time`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Pending activation requests"
            description="Oldest first"
            action={
              canSubs ? (
                <Link href="/admin/requests" className="text-sm font-semibold text-brand-700 hover:underline">
                  Open queue
                </Link>
              ) : undefined
            }
          />
          {!canSubs ? (
            <p className="flex items-center gap-2 px-5 py-8 text-sm text-slate-500">
              <Lock className="size-4" /> Your role doesn&apos;t include subscription requests.
            </p>
          ) : pending.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No pending requests. You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y divide-line">
              {pending.slice(0, 5).map((r) => {
                const l = state.learners.find((x) => x.id === r.learnerId);
                const plan = state.plans.find((p) => p.days === r.planDays);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <Avatar name={l?.name ?? "?"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{l?.name}</p>
                      <p className="text-xs text-slate-500">
                        {r.planDays} days · {formatINR(r.amount)} {plan && plan.price !== r.amount && <span className="font-semibold text-red-600">(price {formatINR(plan.price)})</span>} · {r.method === "upi" ? "UPI" : "Bank"} · {relativeTime(r.submittedAt, now)}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setReviewId(r.id)}>
                      Review
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Activity · last 14 days" description="Test attempts and new sign-ups" />
          <div className="px-5 pt-4 pb-5">
            <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Bar chart of daily attempts and sign-ups for the last 14 days">
              {series.map((s) => (
                <div key={s.day} className="flex h-full flex-1 flex-col justify-end gap-0.5" title={`${formatDate(s.day)}: ${s.attempts} attempts, ${s.signups} sign-ups`}>
                  <div className="flex flex-1 items-end gap-0.5">
                    <div className="flex-1 rounded-t bg-brand-500" style={{ height: `${(s.attempts / peak) * 100}%`, minHeight: s.attempts ? 4 : 0 }} />
                    <div className="flex-1 rounded-t bg-amber-400" style={{ height: `${(s.signups / peak) * 100}%`, minHeight: s.signups ? 4 : 0 }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5 text-[10px] text-slate-400">
              {series.map((s, i) => (
                <span key={s.day} className="flex-1 text-center">
                  {i % 2 === 1 ? formatWeekday(s.day).slice(0, 2) : ""}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-brand-500" /> Attempts
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-amber-400" /> Sign-ups
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Expiring soon" description="Within 7 days" />
          {expiring.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No subscriptions expiring this week.</p>
          ) : (
            <ul className="divide-y divide-line">
              {expiring.map(({ learner, sub }) => (
                <li key={learner.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={learner.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{learner.name}</p>
                    <p className="text-xs text-slate-500">Expires {formatDate(sub.expiresAt!)}</p>
                  </div>
                  <Badge tone="amber">{sub.daysLeft}d</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Content health" />
          <ul className="divide-y divide-line text-sm">
            <li className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="flex items-center gap-2">
                <Gift className="size-4 text-brand-600" /> Free demo test
              </span>
              {demo ? (
                <Link href={`/admin/tests/${demo.id}`} className="max-w-40 truncate font-semibold text-brand-700 hover:underline">
                  {demo.title}
                </Link>
              ) : (
                <Badge tone="red">Not set</Badge>
              )}
            </li>
            <li className="flex items-center justify-between px-5 py-3">
              <span>Draft courses</span>
              <Badge tone={drafts.length ? "amber" : "slate"}>{drafts.length}</Badge>
            </li>
            <li className="flex items-center justify-between px-5 py-3">
              <span>Unpublished tests</span>
              <Badge tone={hiddenTests.length ? "amber" : "slate"}>{hiddenTests.length}</Badge>
            </li>
            <li className="flex items-center justify-between px-5 py-3">
              <span>Tests awaiting solution release</span>
              <Badge tone="sky">{state.tests.filter((t) => t.resultRelease === "manual" && !t.solutionsReleased && t.published).length}</Badge>
            </li>
            <li className="flex items-center justify-between px-5 py-3">
              <span>Courses without a preview lesson</span>
              {(() => {
                const n = state.courses.filter((c) => c.status !== "archived" && !c.modules.some((m) => m.lessons.some((l) => l.isPreview))).length;
                return n ? (
                  <Badge tone="red">
                    <TriangleAlert /> {n}
                  </Badge>
                ) : (
                  <Badge tone="green">0</Badge>
                );
              })()}
            </li>
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recent admin activity" />
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {[...state.audit].sort((a, b) => b.at - a.at).slice(0, 8).map((a) => (
              <li key={a.id} className="px-5 py-3">
                <p className="text-sm text-ink">{a.text}</p>
                <p className="text-xs text-slate-500">
                  {a.actor} · {relativeTime(a.at, now)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4")}>
        {[
          { href: "/admin/courses/new", label: "Create a course", perm: hasPermission(admin, "courses"), icon: <BookOpen /> },
          { href: "/admin/tests/new", label: "Build a test", perm: hasPermission(admin, "tests"), icon: <ClipboardList /> },
          { href: "/admin/learners", label: "Find a learner", perm: hasPermission(admin, "learners"), icon: <Users /> },
          { href: "/admin/settings", label: "Pricing & settings", perm: true, icon: <CreditCard /> },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className={cn("flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition-colors hover:border-brand-300", !q.perm && "opacity-60")}
          >
            <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 [&_svg]:size-5">{q.icon}</span>
            <span className="flex-1 text-sm font-bold text-ink">{q.label}</span>
            {q.perm ? <ArrowRight className="size-4 text-slate-400" /> : <Lock className="size-4 text-slate-400" />}
          </Link>
        ))}
      </div>

      <ReviewRequestDialog requestId={reviewId} onClose={() => setReviewId(null)} />
    </div>
  );
}
