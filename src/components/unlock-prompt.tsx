"use client";

import { Clock, Crown, Lock, LogIn, TriangleAlert } from "lucide-react";
import type { SubscriptionInfo } from "@/lib/access";
import type { Learner } from "@/lib/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { ButtonLink } from "./ui/button";

/**
 * Explains why content is locked and what the learner can do next.
 * Covers: visitor, no subscription, pending request, rejected request, expired subscription.
 */
export function UnlockPrompt({
  learner,
  sub,
  next,
  what = "this content",
  className,
  tone = "light",
}: {
  learner: Learner | undefined;
  sub: SubscriptionInfo;
  next: string;
  what?: string;
  className?: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const box = cn("rounded-2xl p-5", dark ? "bg-white/5 text-white ring-1 ring-white/15" : "border border-line bg-surface", className);
  const title = cn("text-base font-bold", dark ? "text-white" : "text-fg");
  const body = cn("mt-1 text-sm leading-relaxed", dark ? "text-white/70" : "text-slate-500");
  const iconBox = (cls: string, icon: React.ReactNode) => (
    <span className={cn("mb-3 grid size-10 place-items-center rounded-xl [&_svg]:size-5", cls)}>{icon}</span>
  );

  if (!learner) {
    return (
      <div className={box}>
        {iconBox(dark ? "bg-white/10 text-white" : "bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300", <LogIn />)}
        <p className={title}>Sign in to unlock {what}</p>
        <p className={body}>Create a free account, then activate the all-access subscription to unlock every lesson and test.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/signup?next=${encodeURIComponent(next)}`} size="sm">
            Sign up free
          </ButtonLink>
          <ButtonLink href={`/login?next=${encodeURIComponent(next)}`} size="sm" variant={dark ? "white" : "secondary"}>
            Log in
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (sub.pending) {
    return (
      <div className={box}>
        {iconBox("bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300", <Clock />)}
        <p className={title}>Activation request pending</p>
        <p className={body}>
          Your {sub.pending.planDays}-day request submitted on {formatDateTime(sub.pending.submittedAt)} is awaiting admin verification. {what[0].toUpperCase() + what.slice(1)} unlocks as soon as it&apos;s approved.
        </p>
        <ButtonLink href="/dashboard/subscription" size="sm" variant={dark ? "white" : "secondary"} className="mt-4">
          View request status
        </ButtonLink>
      </div>
    );
  }

  if (sub.status === "expired") {
    return (
      <div className={box}>
        {iconBox("bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400", <TriangleAlert />)}
        <p className={title}>Your subscription expired on {formatDate(sub.expiresAt!)}</p>
        <p className={body}>Your progress and exam history are safe. Renew to unlock {what} again.</p>
        <ButtonLink href="/subscribe" size="sm" className="mt-4">
          <Crown /> Renew subscription
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className={box}>
      {iconBox(dark ? "bg-white/10 text-white" : "bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300", <Lock />)}
      <p className={title}>Subscribe to unlock {what}</p>
      <p className={body}>
        {sub.lastRejected
          ? "Your last activation request was rejected. Check the reason and submit a new request."
          : "One all-access subscription unlocks every published lesson and regular test."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href="/subscribe" size="sm">
          <Crown /> View plans
        </ButtonLink>
        {sub.lastRejected && (
          <ButtonLink href="/dashboard/subscription" size="sm" variant={dark ? "white" : "secondary"}>
            See rejection reason
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
