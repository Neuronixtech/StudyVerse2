"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Crown,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  UserRound,
} from "lucide-react";
import { subscriptionLabel } from "@/lib/access";
import { useSession } from "@/lib/hooks";
import { logoutLearner } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Logo } from "../brand";
import { ButtonLink } from "../ui/button";
import { Avatar, Skeleton } from "../ui/feedback";
import { Drawer } from "../ui/modal";
import { Menu, MenuItem } from "../ui/menu";
import { toast } from "../ui/toast";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/tests", label: "Tests" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const toneDot = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", slate: "bg-slate-400" };

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, learner, sub } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const status = subscriptionLabel(sub);

  function logout() {
    logoutLearner();
    toast({ title: "Signed out", description: "You've been signed out of the prototype session.", simulated: true });
    router.push("/");
  }

  const planLink = learner ? (
    <Link
      href="/dashboard/subscription"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
        sub.status === "active"
          ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-500/15"
          : "border-line-strong bg-surface text-slate-700 hover:border-brand-300",
      )}
    >
      {sub.status === "active" ? <Crown className="size-4 text-emerald-600 dark:text-emerald-400" /> : <span className={cn("size-2 rounded-full", toneDot[status.tone])} />}
      {sub.status === "active" ? `Active · ${sub.daysLeft}d left` : status.label}
    </Link>
  ) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4 lg:h-[72px]">
        <Logo />

        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                isActive(pathname, item.href) ? "text-brand-700 dark:text-brand-300" : "text-slate-600 hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}
          {!learner && (
            <Link
              href="/subscribe"
              aria-current={isActive(pathname, "/subscribe") ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                isActive(pathname, "/subscribe") ? "text-brand-700 dark:text-brand-300" : "text-slate-600 hover:text-fg",
              )}
            >
              Subscribe
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {!ready ? (
            <Skeleton className="h-9 w-40" />
          ) : learner ? (
            <>
              <div className="hidden lg:block">{planLink}</div>
              <Menu
                label="Account"
                trigger={(p) => (
                  <button
                    type="button"
                    onClick={p.toggle}
                    aria-expanded={p["aria-expanded"]}
                    aria-haspopup={p["aria-haspopup"]}
                    className="flex items-center gap-2 rounded-full border border-line py-1 pr-2.5 pl-1 transition-colors hover:border-brand-300"
                  >
                    <Avatar name={learner.name} size="sm" />
                    <span className="hidden max-w-28 truncate text-sm font-semibold text-fg sm:block">{learner.name.split(" ")[0]}</span>
                    <ChevronDown className="size-4 text-slate-400" />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <div className="border-b border-line px-2.5 pt-1.5 pb-2.5">
                      <p className="text-sm font-bold text-fg">{learner.name}</p>
                      <p className="truncate text-xs text-slate-500">{learner.email}</p>
                    </div>
                    <div className="py-1">
                      {[
                        { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
                        { href: "/dashboard/courses", label: "My courses", icon: <BookOpen /> },
                        { href: "/dashboard/attempts", label: "Attempt history", icon: <ClipboardList /> },
                        { href: "/dashboard/subscription", label: "Subscription", icon: <CreditCard /> },
                        { href: "/dashboard/profile", label: "Profile & settings", icon: <UserRound /> },
                      ].map((i) => (
                        <MenuItem
                          key={i.href}
                          icon={i.icon}
                          onSelect={() => {
                            close();
                            router.push(i.href);
                          }}
                        >
                          {i.label}
                        </MenuItem>
                      ))}
                    </div>
                    <div className="border-t border-line pt-1">
                      <MenuItem
                        danger
                        icon={<LogOut />}
                        onSelect={() => {
                          close();
                          logout();
                        }}
                      >
                        Log out
                      </MenuItem>
                    </div>
                  </>
                )}
              </Menu>
            </>
          ) : (
            <>
              <ButtonLink href={`/login?next=${encodeURIComponent(pathname)}`} variant="ghost" size="sm" className="hidden sm:inline-flex">
                Log in
              </ButtonLink>
              <ButtonLink href={`/signup?next=${encodeURIComponent(pathname)}`} size="sm" pill className="hidden sm:inline-flex">
                Sign up free
              </ButtonLink>
            </>
          )}
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-fg hover:bg-slate-100 md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="size-5" />
          </button>
        </div>
      </div>

      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menu" side="right" width="max-w-xs">
        <nav aria-label="Mobile" className="flex flex-col p-3">
          {[...NAV, ...(learner ? [{ href: "/dashboard", label: "Dashboard" }] : []), { href: "/subscribe", label: learner ? "Subscription & plans" : "Subscribe" }].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-3 text-base font-semibold",
                isActive(pathname, item.href) ? "bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300" : "text-fg hover:bg-slate-50",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          {learner ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={learner.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-fg">{learner.name}</p>
                  <p className="text-xs text-slate-500">{status.label}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-500/30 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400"
              >
                <LogOut className="size-4" /> Log out
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              <ButtonLink href={`/signup?next=${encodeURIComponent(pathname)}`} onClick={() => setMobileOpen(false)} block>
                Sign up free
              </ButtonLink>
              <ButtonLink href={`/login?next=${encodeURIComponent(pathname)}`} onClick={() => setMobileOpen(false)} variant="secondary" block>
                Log in
              </ButtonLink>
            </div>
          )}
        </div>
      </Drawer>
    </header>
  );
}
