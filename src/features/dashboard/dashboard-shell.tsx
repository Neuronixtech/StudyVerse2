"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, CreditCard, LayoutDashboard, LockKeyhole, MapPin, Package, UserRound } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Skeleton } from "@/components/ui/feedback";
import { subscriptionLabel } from "@/lib/access";
import { useSession } from "@/lib/hooks";
import { examName } from "@/lib/mock/catalog";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/courses", label: "My courses", icon: BookOpen },
  { href: "/dashboard/attempts", label: "Attempt history", icon: ClipboardList },
  { href: "/dashboard/subscription", label: "Subscription", icon: CreditCard },
  { href: "/dashboard/orders", label: "Book orders", icon: Package },
  { href: "/dashboard/addresses", label: "Addresses", icon: MapPin },
  { href: "/dashboard/profile", label: "Profile & settings", icon: UserRound },
];

const toneDot = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", slate: "bg-slate-400" };

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, learner, sub } = useSession();

  // Layouts must always render `children` so Next can validate the page segment;
  // while the session loads (or is missing) the page is kept hidden.
  const hiddenChildren = <div hidden>{children}</div>;

  if (!ready) {
    return (
      <div className="container-page grid grid-cols-1 gap-8 py-10 lg:grid-cols-[250px_1fr]">
        {hiddenChildren}
        <Skeleton className="hidden h-80 lg:block" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!learner) {
    return (
      <div className="container-page py-20">
        {hiddenChildren}
        <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 dark:bg-brand-400/10 text-brand-600 dark:text-brand-400">
            <LockKeyhole className="size-7" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold">Sign in to view your dashboard</h1>
          <p className="mt-2 text-sm text-slate-500">Your progress, attempt history and subscription status live here.</p>
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ButtonLink href={`/login?next=${encodeURIComponent(pathname)}`}>Log in</ButtonLink>
            <ButtonLink href={`/signup?next=${encodeURIComponent(pathname)}`} variant="secondary">
              Create account
            </ButtonLink>
          </div>
          <p className="mt-5 text-xs text-slate-400">Tip: use the Prototype button (bottom-left) to switch demo personas.</p>
        </div>
      </div>
    );
  }

  const status = subscriptionLabel(sub);

  return (
    <div className="container-page grid grid-cols-1 gap-8 py-8 lg:grid-cols-[250px_1fr] lg:py-10">
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="hidden rounded-2xl border border-line bg-surface p-4 shadow-card lg:block">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <Avatar name={learner.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-bold text-fg">{learner.name}</p>
              <p className="text-xs text-slate-500">
                {examName(learner.targetExam)} {learner.targetYear}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span className={cn("size-2 rounded-full", toneDot[status.tone])} /> {status.label}
              </p>
            </div>
          </div>
          <nav aria-label="Dashboard" className="mt-3 space-y-0.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active ? "bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300" : "text-slate-600 hover:bg-slate-50 hover:text-fg",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <nav aria-label="Dashboard" className="relative scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold",
                  active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-slate-600",
                )}
              >
                <Icon className="size-4" /> {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
