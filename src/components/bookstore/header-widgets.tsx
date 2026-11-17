"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Mail, ShoppingCart } from "lucide-react";
import { cartKey, markNotificationsRead } from "@/lib/bookstore-store";
import { useSession } from "@/lib/hooks";
import { cn, relativeTime } from "@/lib/utils";
import { Menu } from "../ui/menu";

export function CartButton() {
  const { state, learner, ready } = useSession();
  const count = ready ? (state.carts[cartKey(learner?.id)] ?? []).reduce((a, c) => a + c.qty, 0) : 0;
  return (
    <Link
      href="/books/cart"
      className="relative grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-fg"
      aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart, empty"}
    >
      <ShoppingCart className="size-5" />
      {count > 0 && (
        <span className="absolute top-1 right-0.5 grid min-w-4.5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] leading-4.5 font-bold text-white ring-2 ring-surface">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/** In-app notifications (email delivery is only simulated in the prototype) */
export function NotificationBell() {
  const router = useRouter();
  const { state, learner, now } = useSession();
  if (!learner) return null;
  const mine = state.notifications.filter((n) => n.learnerId === learner.id).sort((a, b) => b.at - a.at);
  const unread = mine.filter((n) => !n.read).length;

  return (
    <Menu
      label="Notifications"
      className="w-[min(22rem,calc(100vw-2rem))] p-0"
      trigger={(p) => (
        <button
          type="button"
          onClick={() => {
            p.toggle();
          }}
          aria-expanded={p["aria-expanded"]}
          aria-haspopup={p["aria-haspopup"]}
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-fg"
        >
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-red-500 ring-2 ring-surface" />}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-fg">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => markNotificationsRead(learner.id)} className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {mine.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {mine.slice(0, 12).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      markNotificationsRead(learner.id);
                      if (n.href) router.push(n.href);
                    }}
                    className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50", !n.read && "bg-brand-50/50 dark:bg-brand-400/10")}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-500")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-fg">{n.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{n.body}</span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                        {relativeTime(n.at, now)}
                        {n.email && (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300" title="Email delivery is simulated in the prototype">
                            <Mail className="size-3" /> email simulated
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Menu>
  );
}
