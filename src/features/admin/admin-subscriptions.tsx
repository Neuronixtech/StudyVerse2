"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CircleCheck, CircleX, Copy, CreditCard, FileImage, Inbox, Search, TriangleAlert, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, Callout, Card, EmptyState, ErrorState, PageHeader, SimulatedNote, Skeleton, StatCard } from "@/components/ui/feedback";
import { Segmented, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { getSubscription, hasPermission } from "@/lib/access";
import { useSession, useSimulatedLoad } from "@/lib/hooks";
import { activateManually, approveRequest, rejectRequest } from "@/lib/store";
import type { PlanDays, RequestStatus, SubscriptionRequest } from "@/lib/types";
import { cn, DAY, formatDate, formatDateTime, formatINR, relativeTime } from "@/lib/utils";
import { Restricted } from "./admin-shell";

const QUICK_REASONS = [
  "We couldn't find this transaction reference in our statement. Please check the ID and resubmit.",
  "The amount paid doesn't match the selected plan price.",
  "The screenshot is unclear — please attach a clearer payment screenshot.",
  "This appears to be a duplicate of an earlier request.",
];

/* --------------------------- Review dialog --------------------------- */

export function ReviewRequestDialog({ requestId, onClose }: { requestId: string | null; onClose: () => void }) {
  const { state, admin, now } = useSession();
  const req = state.requests.find((r) => r.id === requestId);
  const [mode, setMode] = useState<"view" | "approve" | "reject">("view");
  const [days, setDays] = useState<PlanDays | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const close = () => {
    setMode("view");
    setDays(null);
    setReason("");
    setReasonError(null);
    onClose();
  };

  if (!req || !admin) return <Modal open={false} onClose={close} title="" />;
  const learner = state.learners.find((l) => l.id === req.learnerId);
  const sub = getSubscription(state, req.learnerId, now);
  const plan = state.plans.find((p) => p.days === req.planDays);
  const chosen = days ?? req.planDays;
  const startsAt = sub.status === "active" && sub.expiresAt ? sub.expiresAt : now;
  const canAct = hasPermission(admin, "subscriptions") && req.status === "pending";
  const reviewer = state.admins.find((a) => a.id === req.reviewedBy)?.name;

  const approve = () => {
    approveRequest(req.id, chosen, admin.id);
    toast({ title: `Approved — ${learner?.name ?? "learner"} is now active`, description: `${chosen} days until ${formatDate(startsAt + chosen * DAY)}.`, simulated: true });
    close();
  };
  const reject = () => {
    if (reason.trim().length < 10) return setReasonError("Give the learner a clear reason (at least 10 characters).");
    rejectRequest(req.id, reason.trim(), admin.id);
    toast({ title: "Request rejected", description: "The learner will see your reason and can resubmit.", simulated: true, tone: "info" });
    close();
  };

  return (
    <Modal
      open={!!req}
      onClose={close}
      size="lg"
      title={req.status === "pending" ? "Review activation request" : "Activation request"}
      description={`Submitted ${formatDateTime(req.submittedAt)}`}
      footer={
        !canAct ? (
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
        ) : mode === "approve" ? (
          <>
            <Button variant="secondary" onClick={() => setMode("view")}>
              Back
            </Button>
            <Button onClick={approve} className="bg-emerald-600 hover:bg-emerald-700">
              <CircleCheck /> Confirm approval
            </Button>
          </>
        ) : mode === "reject" ? (
          <>
            <Button variant="secondary" onClick={() => setMode("view")}>
              Back
            </Button>
            <Button variant="danger" onClick={reject}>
              <CircleX /> Confirm rejection
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setMode("reject")} className="text-red-600">
              <CircleX /> Reject
            </Button>
            <Button onClick={() => setMode("approve")} className="bg-emerald-600 hover:bg-emerald-700">
              <CircleCheck /> Approve
            </Button>
          </>
        )
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={learner?.name ?? "?"} size="lg" />
            <div className="min-w-0">
              <p className="font-bold text-ink">{learner?.name}</p>
              <p className="truncate text-xs text-slate-500">{learner?.email}</p>
              <p className="text-xs text-slate-500">{learner?.phone}</p>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="text-xs font-semibold text-slate-500">Current subscription</p>
            <p className="mt-0.5 font-semibold text-ink">
              {sub.status === "active" ? `Active until ${formatDate(sub.expiresAt!)}` : sub.status === "expired" ? `Expired on ${formatDate(sub.expiresAt!)}` : "No subscription yet"}
            </p>
          </div>
          <dl className="space-y-2 text-sm">
            <Row k="Plan requested" v={`${req.planDays} days (${plan ? formatINR(plan.price) : "—"})`} />
            <Row
              k="Amount paid"
              v={
                <span className={cn(plan && req.amount !== plan.price && "text-red-600")}>
                  {formatINR(req.amount)}
                  {plan && req.amount !== plan.price && " · mismatch"}
                </span>
              }
            />
            <Row k="Method" v={req.method === "upi" ? "UPI" : "Bank transfer"} />
            <Row
              k="Reference"
              v={
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(req.reference).then(() => toast({ title: "Reference copied", tone: "info" }))}
                  className="inline-flex items-center gap-1.5 font-mono hover:text-brand-700"
                  title="Copy reference"
                >
                  {req.reference} <Copy className="size-3.5" />
                </button>
              }
            />
          </dl>
          {req.note && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900 ring-1 ring-sky-200">
              <strong>Learner note:</strong> {req.note}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500">Payment proof</p>
          {req.screenshotName ? (
            <div className="mt-2 grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line-strong bg-slate-50 p-4 text-center">
              <div>
                <FileImage className="mx-auto size-8 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-ink">{req.screenshotName}</p>
                <p className="mt-1 text-xs text-slate-500">Preview unavailable — files aren&apos;t uploaded in the prototype.</p>
              </div>
            </div>
          ) : (
            <p className="mt-2 rounded-xl border border-dashed border-line-strong bg-slate-50 p-6 text-center text-sm text-slate-500">No screenshot attached</p>
          )}
          <p className="mt-3 text-xs text-slate-500">Verify the payment in your UPI/bank statement outside StudyVerse before approving.</p>
        </div>
      </div>

      {req.status !== "pending" && (
        <Callout className="mt-5" tone={req.status === "approved" ? "success" : "danger"} title={req.status === "approved" ? `Approved for ${req.approvedDays} days` : "Rejected"}>
          {req.status === "rejected" && <p>{req.rejectionReason}</p>}
          <p>
            By {reviewer ?? "admin"} on {req.reviewedAt ? formatDateTime(req.reviewedAt) : "—"}
          </p>
        </Callout>
      )}

      {canAct && mode === "approve" && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-bold text-ink">Activation duration</p>
          <Segmented
            label="Duration to activate"
            className="mt-2"
            value={String(chosen) as "30" | "90" | "365"}
            onChange={(v) => setDays(Number(v) as PlanDays)}
            options={state.plans.map((p) => ({ value: String(p.days) as "30" | "90" | "365", label: `${p.days} days` }))}
          />
          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-200">
              <dt className="text-xs text-slate-500">Starts</dt>
              <dd className="font-bold text-ink">{formatDate(startsAt)}</dd>
              {sub.status === "active" && <dd className="text-[11px] text-emerald-700">Extends current expiry</dd>}
            </div>
            <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-200">
              <dt className="text-xs text-slate-500">New expiry</dt>
              <dd className="font-bold text-ink">{formatDate(startsAt + chosen * DAY)}</dd>
            </div>
          </dl>
          {chosen !== req.planDays && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <TriangleAlert className="size-3.5" /> Different from the {req.planDays} days the learner requested.
            </p>
          )}
          <SimulatedNote className="mt-3">Approval is simulated — no payment is verified and no real access is granted.</SimulatedNote>
        </div>
      )}

      {canAct && mode === "reject" && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50/50 p-4">
          <label htmlFor="reject-reason" className="text-sm font-bold text-ink">
            Reason shown to the learner <span className="text-red-500">*</span>
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setReason(r);
                  setReasonError(null);
                }}
                className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-left text-xs text-red-800 hover:bg-red-50"
              >
                {r.split(" — ")[0].split(".")[0]}
              </button>
            ))}
          </div>
          <Textarea
            id="reject-reason"
            className="mt-3"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(null);
            }}
            aria-invalid={reasonError ? true : undefined}
            placeholder="Explain what's wrong and what the learner should do next"
          />
          {reasonError && <p className="mt-1.5 text-xs font-semibold text-red-600">{reasonError}</p>}
        </div>
      )}
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-semibold text-ink">{v}</dd>
    </div>
  );
}

const STATUS_TONE: Record<RequestStatus, "amber" | "green" | "red"> = { pending: "amber", approved: "green", rejected: "red" };

/* ---------------------------- Requests page ---------------------------- */

export function RequestsPage() {
  const { state, admin, now } = useSession();
  const [tab, setTab] = useState<RequestStatus | "all">("pending");
  const [q, setQ] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const load = useSimulatedLoad("admin-requests");

  const learnerName = (id: string) => state.learners.find((l) => l.id === id)?.name ?? "Unknown";
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.requests
      .filter((r) => tab === "all" || r.status === tab)
      .filter((r) => {
        if (!needle) return true;
        const l = state.learners.find((x) => x.id === r.learnerId);
        return `${l?.name} ${l?.email} ${r.reference}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => (tab === "pending" ? a.submittedAt - b.submittedAt : b.submittedAt - a.submittedAt));
  }, [state.requests, state.learners, tab, q]);

  if (!hasPermission(admin, "subscriptions")) return <Restricted what="activation requests" />;
  const count = (s: RequestStatus | "all") => (s === "all" ? state.requests.length : state.requests.filter((r) => r.status === s).length);

  return (
    <div className="space-y-6">
      <PageHeader title="Activation requests" description="Verify offline payments, then approve with a duration or reject with a reason. Oldest pending requests are shown first." />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            label="Request status"
            variant="pill"
            value={tab}
            onChange={setTab}
            items={[
              { value: "pending", label: "Pending", count: count("pending") },
              { value: "approved", label: "Approved", count: count("approved") },
              { value: "rejected", label: "Rejected", count: count("rejected") },
              { value: "all", label: "All", count: count("all") },
            ]}
          />
          <label className="relative lg:w-72">
            <span className="sr-only">Search requests</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search learner or reference"
              className="h-10 w-full rounded-lg border border-line-strong pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:shadow-ring"
            />
          </label>
        </div>

        {load.status === "loading" ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : load.status === "error" ? (
          <div className="p-4">
            <ErrorState title="Couldn't load requests" onRetry={load.retry} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              className="border-0"
              icon={<Inbox />}
              title={tab === "pending" ? "You're all caught up" : "No requests here"}
              description={tab === "pending" ? "New activation requests from learners will appear here." : "Try a different filter or search."}
            />
          </div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Learner</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Plan</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Amount</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Reference</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Submitted</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <RequestRow key={r.id} r={r} name={learnerName(r.learnerId)} email={state.learners.find((l) => l.id === r.learnerId)?.email} now={now} onReview={() => setReviewId(r.id)} />
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 p-4">
                  <Avatar name={learnerName(r.learnerId)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{learnerName(r.learnerId)}</p>
                    <p className="text-xs text-slate-500">
                      {r.planDays}d · {formatINR(r.amount)} · {relativeTime(r.submittedAt, now)}
                    </p>
                  </div>
                  <Button size="sm" variant={r.status === "pending" ? "primary" : "secondary"} onClick={() => setReviewId(r.id)}>
                    {r.status === "pending" ? "Review" : "View"}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <ReviewRequestDialog requestId={reviewId} onClose={() => setReviewId(null)} />
    </div>
  );
}

function RequestRow({ r, name, email, now, onReview }: { r: SubscriptionRequest; name: string; email?: string; now: number; onReview: () => void }) {
  return (
    <tr className="border-t border-line hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={name} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">{r.planDays} days</td>
      <td className="px-3 py-3 font-semibold text-ink">
        {formatINR(r.amount)}
        <span className="block text-xs font-normal text-slate-500">{r.method === "upi" ? "UPI" : "Bank"}</span>
      </td>
      <td className="px-3 py-3 font-mono text-xs">
        {r.reference}
        {r.screenshotName && <span className="mt-0.5 flex items-center gap-1 font-sans text-[11px] text-slate-500"><FileImage className="size-3" /> proof</span>}
      </td>
      <td className="px-3 py-3 text-slate-600" title={formatDateTime(r.submittedAt)}>
        {relativeTime(r.submittedAt, now)}
      </td>
      <td className="px-3 py-3">
        <Badge tone={STATUS_TONE[r.status]} dot>
          {r.status[0].toUpperCase() + r.status.slice(1)}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <Button size="sm" variant={r.status === "pending" ? "primary" : "secondary"} onClick={onReview}>
          {r.status === "pending" ? "Review" : "View"}
        </Button>
      </td>
    </tr>
  );
}

/* -------------------------- Subscriptions page -------------------------- */

export function SubscriptionsPage() {
  const { state, admin, now } = useSession();
  const [tab, setTab] = useState<"active" | "expiring" | "expired">("active");
  const load = useSimulatedLoad("admin-subs");
  if (!hasPermission(admin, "subscriptions")) return <Restricted what="subscriptions" />;

  const rows = state.learners
    .map((l) => ({ learner: l, sub: getSubscription(state, l.id, now) }))
    .filter((r) => r.sub.status !== "none");
  const active = rows.filter((r) => r.sub.status === "active");
  const expiring = active.filter((r) => r.sub.daysLeft <= 7);
  const expired = rows.filter((r) => r.sub.status === "expired");
  const list = (tab === "active" ? active : tab === "expiring" ? expiring : expired).sort((a, b) => (a.sub.expiresAt ?? 0) - (b.sub.expiresAt ?? 0));
  const revenue = state.requests.filter((r) => r.status === "approved").reduce((a, r) => a + r.amount, 0);
  const adminName = (id?: string) => state.admins.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" description="Active and expired subscription records. Renewals extend the existing expiry date." />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Active" value={active.length} icon={<CreditCard />} tone="emerald" />
        <StatCard label="Expiring in 7 days" value={expiring.length} icon={<TriangleAlert />} tone="amber" />
        <StatCard label="Expired" value={expired.length} icon={<CircleX />} tone="rose" />
        <StatCard label="Approved payments" value={formatINR(revenue)} icon={<Wallet />} hint="Mock total of approved requests" />
      </div>
      <Card>
        <div className="border-b border-line p-4">
          <Tabs
            label="Subscription status"
            variant="pill"
            value={tab}
            onChange={setTab}
            items={[
              { value: "active", label: "Active", count: active.length },
              { value: "expiring", label: "Expiring soon", count: expiring.length },
              { value: "expired", label: "Expired", count: expired.length },
            ]}
          />
        </div>
        {load.status === "loading" ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : load.status === "error" ? (
          <div className="p-4">
            <ErrorState onRetry={load.retry} />
          </div>
        ) : list.length === 0 ? (
          <div className="p-4">
            <EmptyState className="border-0" icon={<CreditCard />} title="No subscriptions in this view" />
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Learner</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Period</th>
                  <th className="px-3 py-2.5 text-left font-semibold">{tab === "expired" ? "Expired" : "Days left"}</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Last activated by</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map(({ learner, sub }) => {
                  const last = sub.periods[sub.periods.length - 1];
                  return (
                    <tr key={learner.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={learner.name} size="sm" />
                          <div>
                            <p className="font-semibold text-ink">{learner.name}</p>
                            <p className="text-xs text-slate-500">{learner.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatDate(sub.periods[0].startsAt)} → {formatDate(sub.expiresAt!)}
                        <span className="block text-xs text-slate-400">{sub.periods.length} period{sub.periods.length > 1 ? "s" : ""}</span>
                      </td>
                      <td className="px-3 py-3">
                        {sub.status === "active" ? (
                          <Badge tone={sub.daysLeft <= 7 ? "amber" : "green"}>{sub.daysLeft} days</Badge>
                        ) : (
                          <span className="text-slate-600">{relativeTime(sub.expiresAt!, now)}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{adminName(last?.activatedBy)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/learners/${learner.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                          View learner
                        </Link>
                      </td>
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

/* ----------------------- Manual activation dialog ----------------------- */

export function ActivateDialog({ learnerId, open, onClose }: { learnerId: string; open: boolean; onClose: () => void }) {
  const { state, admin, now } = useSession();
  const [days, setDays] = useState<PlanDays>(30);
  const learner = state.learners.find((l) => l.id === learnerId);
  const sub = getSubscription(state, learnerId, now);
  const startsAt = sub.status === "active" && sub.expiresAt ? sub.expiresAt : now;
  if (!admin || !learner) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Activate subscription for ${learner.name}`}
      description="Use for payments verified outside the request flow."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              activateManually(learnerId, days, admin.id);
              toast({ title: `${days} days activated for ${learner.name}`, simulated: true });
              onClose();
            }}
          >
            Activate
          </Button>
        </>
      }
    >
      <Segmented
        label="Duration"
        className="w-full"
        value={String(days) as "30" | "90" | "365"}
        onChange={(v) => setDays(Number(v) as PlanDays)}
        options={state.plans.map((p) => ({ value: String(p.days) as "30" | "90" | "365", label: `${p.days} days` }))}
      />
      <p className="mt-4 text-sm text-slate-600">
        Runs {formatDate(startsAt)} → <strong className="text-ink">{formatDate(startsAt + days * DAY)}</strong>
        {sub.status === "active" && " (extends current expiry)"}.
      </p>
      <SimulatedNote className="mt-3" />
    </Modal>
  );
}
