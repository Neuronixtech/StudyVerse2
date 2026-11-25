"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ClipboardList,
  CreditCard,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu as MenuIcon,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Store,
  Library,
  ShoppingBag,
  Truck,
  RotateCcw,
  BarChart3,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand";
import { PrototypeToolbar } from "@/components/layout/prototype-toolbar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Skeleton } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/modal";
import { Menu, MenuItem } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import { hasPermission } from "@/lib/access";
import { useSession } from "@/lib/hooks";
import { logoutAdmin } from "@/lib/store";
import type { Admin, BookPermission, Permission } from "@/lib/types";
import { ALL_BOOK_PERMISSIONS, hasAnyBookPermission } from "@/lib/bookstore";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm?: Permission;
  /** Visible when the admin has any of these bookstore permissions */
  bookPerms?: BookPermission[];
  ownerOnly?: boolean;
  badge?: "pending" | "bookPayments" | "bookReturns";
}

const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Content",
    items: [
      { href: "/admin/courses", label: "Courses", icon: BookOpen, perm: "courses" },
      { href: "/admin/tests", label: "Tests", icon: ClipboardList, perm: "tests" },
    ],
  },
  {
    group: "Learners",
    items: [
      { href: "/admin/learners", label: "Learners", icon: Users, perm: "learners" },
      { href: "/admin/requests", label: "Activation requests", icon: Inbox, perm: "subscriptions", badge: "pending" },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, perm: "subscriptions" },
    ],
  },
  {
    group: "Bookstore",
    items: [
      { href: "/admin/bookstore", label: "Store overview", icon: Store, bookPerms: ALL_BOOK_PERMISSIONS },
      { href: "/admin/bookstore/books", label: "Books & inventory", icon: Library, bookPerms: ["books.edit", "books.photos", "inventory.adjust", "pricing.change"] },
      { href: "/admin/bookstore/orders", label: "Orders & payments", icon: ShoppingBag, bookPerms: ["payments.verify", "orders.process", "cancellations.decide"], badge: "bookPayments" },
      { href: "/admin/bookstore/dispatch", label: "Dispatch", icon: Truck, bookPerms: ["dispatch.manage", "orders.process"] },
      { href: "/admin/bookstore/returns", label: "Returns & refunds", icon: RotateCcw, bookPerms: ["returns.review", "refunds.record", "cancellations.decide"], badge: "bookReturns" },
      { href: "/admin/bookstore/reports", label: "Reports", icon: BarChart3, bookPerms: ["reports.view"] },
      { href: "/admin/bookstore/settings", label: "Store settings", icon: SlidersHorizontal, ownerOnly: true },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/admin/staff", label: "Admins & staff", icon: ShieldCheck, ownerOnly: true },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function canSee(admin: Admin, item: NavItem) {
  if (item.ownerOnly) return admin.role === "owner";
  if (item.bookPerms) return hasAnyBookPermission(admin, item.bookPerms);
  return item.perm ? hasPermission(admin, item.perm) : true;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, ready, admin } = useSession();
  const [navOpen, setNavOpen] = useState(false);
  const pending = state.requests.filter((r) => r.status === "pending").length;
  const badgeCount: Record<NonNullable<NavItem["badge"]>, number> = {
    pending,
    bookPayments: state.bookOrders.filter((o) => o.status === "payment_verification").length,
    bookReturns: state.bookOrders.filter((o) => o.returnRequest?.status === "requested" || o.cancellation?.status === "requested").length,
  };

  // Layouts must always render `children` so Next can validate the page segment;
  // while the session loads (or is missing) the page is kept hidden.
  const hiddenChildren = <div hidden>{children}</div>;

  if (!ready) {
    return (
      <div className="flex min-h-dvh">
        {hiddenChildren}
        <div className="hidden w-64 bg-ink lg:block" />
        <div className="flex-1 space-y-4 p-8">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-100 p-4">
        {hiddenChildren}
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink text-white">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold">Admin sign-in required</h1>
          <p className="mt-2 text-sm text-slate-500">The admin console is only available to invited StudyVerse staff.</p>
          <ButtonLink href={`/admin/login?next=${encodeURIComponent(pathname)}`} block className="mt-6">
            Go to admin login
          </ButtonLink>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">
            Back to StudyVerse
          </Link>
        </div>
        <PrototypeToolbar />
      </div>
    );
  }

  // Section roots (dashboards) only match exactly; everything else matches its sub-pages too
  const isActive = (href: string) => (href === "/admin" || href === "/admin/bookstore" ? pathname === href : pathname.startsWith(href));

  const nav = (
    <nav aria-label="Admin" className="space-y-6 px-3 py-5">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="px-3 text-[11px] font-bold tracking-widest text-slate-500 uppercase">{g.group}</p>
          <ul className="mt-2 space-y-0.5">
            {g.items.map((item) => {
              const allowed = canSee(admin, item);
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setNavOpen(false)}
                    aria-current={active ? "page" : undefined}
                    title={allowed ? undefined : item.ownerOnly ? "Owner only" : "You don't have this permission"}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                      active ? "bg-brand-600 text-white shadow-sm" : allowed ? "text-white/70 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-white/5",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {!allowed && <Lock className="size-3.5" aria-label="Restricted" />}
                    {allowed && item.badge && badgeCount[item.badge] > 0 && (
                      <span className={cn("rounded-full px-1.5 py-px text-[11px] font-bold", active ? "bg-surface text-brand-700 dark:text-brand-300" : "bg-amber-400 text-ink")}>{badgeCount[item.badge]}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const logout = () => {
    logoutAdmin();
    toast({ title: "Signed out of admin console", simulated: true });
    router.push("/admin/login");
  };

  return (
    <div className="flex min-h-dvh bg-slate-100">
      <aside className="surface-ink sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-ink lg:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Logo href="/admin" light suffix="Admin" />
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={admin.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{admin.name}</p>
              <p className="text-xs text-slate-400">{admin.role === "owner" ? "Owner" : "Staff admin"}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <button type="button" className="grid size-10 place-items-center rounded-lg hover:bg-slate-100 lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open admin navigation">
            <MenuIcon className="size-5" />
          </button>
          <Link href="/admin" className="flex items-center gap-2 lg:hidden" aria-label="Admin dashboard">
            <LogoMark className="size-8" />
            <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">Admin</span>
          </Link>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-500/30 md:inline-flex">
            Prototype · mock data
          </span>
          <Link href="/" target="_blank" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:ml-auto sm:flex md:ml-0">
            View site <ExternalLink className="size-3.5" />
          </Link>
          <ThemeToggle className="ml-auto sm:ml-0" />
          <Menu
            label="Admin account"
            trigger={(p) => (
              <button
                type="button"
                onClick={p.toggle}
                aria-expanded={p["aria-expanded"]}
                aria-haspopup={p["aria-haspopup"]}
                className="flex items-center gap-2 rounded-full border border-line py-1 pr-2.5 pl-1 hover:border-brand-300"
              >
                <Avatar name={admin.name} size="sm" />
                <span className="hidden text-sm font-semibold text-fg sm:block">{admin.name.split(" ")[0]}</span>
                <Badge tone={admin.role === "owner" ? "violet" : "sky"} size="xs">
                  {admin.role === "owner" ? "Owner" : "Staff"}
                </Badge>
                <ChevronDown className="size-4 text-slate-400" />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="border-b border-line px-2.5 pt-1.5 pb-2.5">
                  <p className="text-sm font-bold text-fg">{admin.name}</p>
                  <p className="truncate text-xs text-slate-500">{admin.email}</p>
                </div>
                <div className="py-1">
                  <MenuItem
                    icon={<UserCog />}
                    onSelect={() => {
                      close();
                      router.push("/admin/profile");
                    }}
                  >
                    Account settings
                  </MenuItem>
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
        </header>
        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      <Drawer open={navOpen} onClose={() => setNavOpen(false)} title="Admin console" side="left" width="max-w-xs">
        <div className="surface-ink min-h-full bg-ink">{nav}</div>
      </Drawer>
      <PrototypeToolbar sidebarOffset />
    </div>
  );
}

/** Restricted state shown inside a page when the admin lacks a permission */
export function Restricted({ what, ownerOnly }: { what: string; ownerOnly?: boolean }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <Lock className="size-7" />
      </span>
      <h1 className="mt-5 text-xl font-extrabold">{ownerOnly ? "Owner only" : "You don't have access"}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {ownerOnly
          ? `Only the platform owner can manage ${what}.`
          : `Your staff role doesn't include permission to manage ${what}. Ask the owner to grant it from Admins & staff.`}
      </p>
      <ButtonLink href="/admin" variant="secondary" className="mt-6">
        Back to dashboard
      </ButtonLink>
    </div>
  );
}
