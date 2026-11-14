"use client";

import { CircleCheck, Clock, Crown, Sparkles, TriangleAlert } from "lucide-react";
import type { SubscriptionInfo } from "@/lib/access";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { cn, formatDate, formatDateTime, formatINR } from "@/lib/utils";

/** State-aware subscription card: none / pending / rejected / active / expiring / expired */
export function SubscriptionCard({ sub, compact }: { sub: SubscriptionInfo; compact?: boolean }) {
  if (sub.status === "active" && sub.expiresAt) {
    const used = Math.max(0, sub.windowDays - sub.daysLeft);
    const expiring = sub.daysLeft <= 7;
    return (
      <div className={cn("relative overflow-hidden rounded-2xl p-6 text-white shadow-lift", expiring ? "bg-linear-to-br from-amber-500 to-orange-600" : "bg-linear-to-br from-brand-600 to-brand-800")}>
        <div className="bg-grid-faint absolute inset-0 opacity-30" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
                <Crown className="size-4 text-amber-200" /> All-access subscription
              </p>
              <p className="mt-1 text-2xl font-extrabold text-white">{expiring ? `Expiring in ${sub.daysLeft} day${sub.daysLeft === 1 ? "" : "s"}` : "Active"}</p>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/25">{sub.daysLeft} days left</span>
          </div>
          <ProgressBar value={(used / sub.windowDays) * 100} tone="white" className="mt-5" label="Subscription time used" />
          <div className="mt-2 flex justify-between text-xs text-white/80">
            <span>Started {formatDate(sub.startedAt!)}</span>
            <span>Expires {formatDate(sub.expiresAt)}</span>
          </div>
          {sub.pending ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-white/90">
              <Clock className="size-4" /> Renewal for {sub.pending.planDays} days is pending approval.
            </p>
          ) : (
            !compact && (
              <ButtonLink href="/subscribe" variant="white" size="sm" className="mt-5">
                Extend subscription
              </ButtonLink>
            )
          )}
        </div>
      </div>
    );
  }

  if (sub.pending) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <Clock className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-amber-950 dark:text-amber-50">Activation pending</p>
            <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
              Your {sub.pending.planDays}-day request ({formatINR(sub.pending.amount)} via {sub.pending.method === "upi" ? "UPI" : "bank transfer"}, ref{" "}
              <span className="font-mono">{sub.pending.reference}</span>) was submitted {formatDateTime(sub.pending.submittedAt)}. Access unlocks once an admin approves it.
            </p>
            {sub.status === "expired" && sub.expiresAt && <p className="mt-2 text-xs text-amber-900/70 dark:text-amber-100/70">Previous subscription expired on {formatDate(sub.expiresAt)}.</p>}
          </div>
        </div>
      </div>
    );
  }

  if (sub.status === "expired" && sub.expiresAt) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400">
            <TriangleAlert className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold text-red-950 dark:text-red-50">Subscription expired on {formatDate(sub.expiresAt)}</p>
            <p className="mt-1 text-sm text-red-900/80 dark:text-red-100/80">Paid lessons and regular tests are locked. Your progress and exam history are safe.</p>
          </div>
          <ButtonLink href="/subscribe" className="shrink-0">
            Renew now
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white">
      <div className="absolute -top-16 -right-10 size-48 rounded-full bg-brand-500/30 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-brand-300">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold text-white">Unlock every course and test</p>
          <p className="mt-1 text-sm text-white/70">
            {sub.lastRejected ? (
              <span className="text-red-300">Your last request was rejected: {sub.lastRejected.rejectionReason}</span>
            ) : (
              "You're on the free tier: preview lessons and the demo test. Plans start at 30 days."
            )}
          </p>
        </div>
        <ButtonLink href="/subscribe" variant="white" className="shrink-0">
          {sub.lastRejected ? "Submit a new request" : "View plans"}
        </ButtonLink>
      </div>
    </div>
  );
}

export function StatusIcon({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved") return <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />;
  if (status === "rejected") return <TriangleAlert className="size-4 text-red-600 dark:text-red-400" />;
  return <Clock className="size-4 text-amber-600 dark:text-amber-400" />;
}
