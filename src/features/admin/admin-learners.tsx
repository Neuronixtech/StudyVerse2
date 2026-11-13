"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Mail, MapPin, Phone, Plus, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar, Card, CardHeader, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { courseProgress, getSubscription, hasPermission, subscriptionLabel } from "@/lib/access";
import { useSession, useSimulatedLoad } from "@/lib/hooks";
import { examName } from "@/lib/mock/catalog";
import { formatDate, formatDateTime, formatINR, percent, relativeTime } from "@/lib/utils";
import { Restricted } from "./admin-shell";
import { ActivateDialog, ReviewRequestDialog } from "./admin-subscriptions";

type StatusFilter = "all" | "active" | "pending" | "expired" | "none";

export function LearnersPage() {
  const { state, admin, now } = useSession();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const load = useSimulatedLoad("admin-learners");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.learners
      .map((l) => ({ l, sub: getSubscription(state, l.id, now), attempts: state.attempts.filter((a) => a.learnerId === l.id).length }))
      .filter(({ l, sub }) => {
        if (needle && !`${l.name} ${l.email} ${l.phone} ${l.city}`.toLowerCase().includes(needle)) return false;
        if (status === "pending") return !!sub.pending;
        if (status === "active") return sub.status === "active";
        if (status === "expired") return sub.status === "expired";
        if (status === "none") return sub.status === "none";
        return true;
      })
      .sort((a, b) => b.l.joinedAt - a.l.joinedAt);
  }, [state, now, q, status]);

  if (!hasPermission(admin, "learners")) return <Restricted what="learner records" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Learners" description={`${state.learners.length} registered learners. Expired subscriptions never disable an account.`} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search learners</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone or city"
              className="h-10 w-full rounded-lg border border-line-strong pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:shadow-ring"
            />
          </label>
          <div className="sm:w-52">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by subscription status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending request</option>
              <option value="expired">Expired</option>
              <option value="none">No subscription</option>
            </Select>
          </div>
        </div>
        {load.status === "loading" ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : load.status === "error" ? (
          <div className="p-4">
            <ErrorState onRetry={load.retry} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState className="border-0" icon={<Users />} title="No learners match" description="Try another search or status filter." />
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Learner</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Target</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Subscription</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Expiry</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Attempts</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ l, sub, attempts }) => {
                  const s = subscriptionLabel(sub);
                  return (
                    <tr key={l.id} className="border-t border-line hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/admin/learners/${l.id}`} className="flex items-center gap-3">
                          <Avatar name={l.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block font-semibold text-ink hover:text-brand-700">{l.name}</span>
                            <span className="block truncate text-xs text-slate-500">{l.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {examName(l.targetExam)} {l.targetYear}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={s.tone} dot>
                          {s.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{sub.expiresAt ? formatDate(sub.expiresAt) : "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{attempts}</td>
                      <td className="px-3 py-3 text-slate-600">{relativeTime(l.joinedAt, now)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function LearnerDetail({ learnerId }: { learnerId: string }) {
  const { state, admin, now } = useSession();
  const [tab, setTab] = useState<"subscription" | "progress" | "attempts">("subscription");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [activateOpen, setActivateOpen] = useState(false);
  if (!hasPermission(admin, "learners")) return <Restricted what="learner records" />;

  const learner = state.learners.find((l) => l.id === learnerId);
  if (!learner) {
    return <EmptyState icon={<Users />} title="Learner not found" action={<ButtonLink href="/admin/learners">Back to learners</ButtonLink>} />;
  }
  const sub = getSubscription(state, learner.id, now);
  const status = subscriptionLabel(sub);
  const attempts = state.attempts.filter((a) => a.learnerId === learner.id).sort((a, b) => b.submittedAt - a.submittedAt);
  const progress = state.courses.map((c) => ({ c, p: courseProgress(state, learner.id, c) })).filter((x) => x.p.started);
  const canSubs = hasPermission(admin, "subscriptions");
  const adminName = (id?: string) => state.admins.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <Link href="/admin/learners" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-ink">
        <ArrowLeft className="size-4" /> Learners
      </Link>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={learner.name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold">{learner.name}</h1>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
              <span className="flex items-center gap-1.5">
                <Mail className="size-4 text-slate-400" /> {learner.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="size-4 text-slate-400" /> {learner.phone}
              </span>
              {learner.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-slate-400" /> {learner.city}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {examName(learner.targetExam)} {learner.targetYear} · joined {formatDate(learner.joinedAt)}
            </p>
          </div>
          {canSubs && (
            <Button variant="secondary" onClick={() => setActivateOpen(true)}>
              <Plus /> Activate manually
            </Button>
          )}
        </div>
      </Card>

      <Tabs
        label="Learner details"
        value={tab}
        onChange={setTab}
        items={[
          { value: "subscription", label: "Subscription", count: sub.requests.length },
          { value: "progress", label: "Course progress", count: progress.length },
          { value: "attempts", label: "Attempts", count: attempts.length },
        ]}
      />

      {tab === "subscription" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Subscription periods" description={sub.status === "active" ? `Active until ${formatDate(sub.expiresAt!)} · ${sub.daysLeft} days left` : sub.status === "expired" ? `Expired on ${formatDate(sub.expiresAt!)}` : "Never subscribed"} />
            {sub.periods.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No subscription periods.</p>
            ) : (
              <ul className="divide-y divide-line">
                {[...sub.periods].reverse().map((p) => (
                  <li key={p.id} className="px-5 py-3 text-sm">
                    <p className="font-semibold text-ink">
                      {p.days} days · {formatDate(p.startsAt)} → {formatDate(p.expiresAt)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Activated {formatDateTime(p.activatedAt)} by {adminName(p.activatedBy)} {p.requestId ? "· from request" : "· manual"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Activation requests" />
            {sub.requests.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No requests submitted.</p>
            ) : (
              <ul className="divide-y divide-line">
                {sub.requests.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold text-ink">
                        {r.planDays} days · {formatINR(r.amount)}
                      </p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono">{r.reference}</span> · {formatDateTime(r.submittedAt)}
                      </p>
                    </div>
                    <Badge tone={r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "amber"} dot>
                      {r.status}
                    </Badge>
                    {canSubs && (
                      <Button size="xs" variant={r.status === "pending" ? "primary" : "secondary"} onClick={() => setReviewId(r.id)}>
                        {r.status === "pending" ? "Review" : "View"}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "progress" && (
        <Card>
          {progress.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">This learner hasn&apos;t started any course.</p>
          ) : (
            <ul className="divide-y divide-line">
              {progress.map(({ c, p }) => (
                <li key={c.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {c.title} {c.status === "archived" && <Badge tone="slate" size="xs">Archived</Badge>}
                    </p>
                    <p className="text-xs text-slate-500">Last activity {p.last ? relativeTime(p.last.updatedAt, now) : "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 sm:w-64">
                    <ProgressBar value={p.percent} className="flex-1" label={`${c.title} progress`} />
                    <span className="text-xs font-semibold text-slate-600">
                      {p.completed}/{p.total}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "attempts" && (
        <Card>
          {attempts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No test attempts yet.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-semibold">Test</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Score</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Version</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-t border-line">
                      <td className="px-5 py-3 font-semibold text-ink">{a.snapshot.title}</td>
                      <td className="px-3 py-3">
                        {a.result.score}/{a.result.maxScore} <span className="text-xs text-slate-500">({percent(Math.max(0, a.result.score), a.result.maxScore)}%)</span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">v{a.snapshot.version}</td>
                      <td className="px-3 py-3 text-slate-600">{formatDateTime(a.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <ReviewRequestDialog requestId={reviewId} onClose={() => setReviewId(null)} />
      <ActivateDialog learnerId={learner.id} open={activateOpen} onClose={() => setActivateOpen(false)} />
    </div>
  );
}
