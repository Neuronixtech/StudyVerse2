import { Check, CircleX, PauseCircle, RotateCcw } from "lucide-react";
import { ORDER_STEPS, stepIndex } from "@/lib/bookstore";
import type { AddressSnapshot, BookOrder, OrderEvent } from "@/lib/types";
import { cn, formatDateTime, formatINR } from "@/lib/utils";
import { SnapshotCover } from "./book-visuals";

/** Horizontal (desktop) / vertical (mobile) progress through the primary lifecycle */
export function OrderProgress({ order }: { order: BookOrder }) {
  const current = stepIndex(order);
  const terminal = order.status === "cancelled" || order.status === "refunded" || order.status === "returned";
  const rejected = order.status === "payment_rejected";
  return (
    <div>
      {terminal && (
        <div className={cn("mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold", order.status === "cancelled" ? "bg-slate-100 text-slate-700" : "bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-200")}>
          {order.status === "cancelled" ? <CircleX className="size-4" /> : <RotateCcw className="size-4" />}
          {order.status === "cancelled" ? "This order was cancelled." : order.status === "returned" ? "This order has a return in progress or completed." : "This order was refunded."}
        </div>
      )}
      {order.hold && !terminal && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 ring-1 ring-amber-200 dark:ring-amber-500/30">
          <PauseCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>On hold:</strong> {order.hold.reason}
          </span>
        </div>
      )}
      <ol className="grid gap-3 sm:grid-cols-6 sm:gap-0" aria-label="Order progress">
        {ORDER_STEPS.map((label, i) => {
          const done = !terminal && i < current;
          const active = !terminal && i === current;
          const failed = rejected && i === 1;
          return (
            <li key={label} className="relative flex items-center gap-3 sm:flex-col sm:gap-2 sm:text-center" aria-current={active ? "step" : undefined}>
              {i > 0 && <span className={cn("absolute top-4 right-1/2 hidden h-0.5 w-full -translate-y-1/2 sm:block", done || active ? "bg-brand-500" : "bg-slate-200")} aria-hidden />}
              <span
                className={cn(
                  "relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ring-4 ring-surface",
                  failed ? "bg-red-500 text-white" : done ? "bg-brand-600 text-white" : active ? "bg-brand-100 dark:bg-brand-400/15 text-brand-800 dark:text-brand-200 ring-brand-200 dark:ring-brand-400/30" : "bg-slate-100 text-slate-400",
                )}
              >
                {failed ? <CircleX className="size-4" /> : done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn("text-xs font-semibold", failed ? "text-red-600 dark:text-red-400" : done || active ? "text-fg" : "text-slate-400")}>{failed ? "Payment rejected" : label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function OrderTimeline({ events, audit = false }: { events: OrderEvent[]; audit?: boolean }) {
  // Newest first; events logged in the same millisecond (e.g. "Payment confirmed" then "Moved to Processing") keep their real order
  const list = events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => audit || e.customerVisible)
    .sort((a, b) => b.e.at - a.e.at || b.i - a.i)
    .map(({ e }) => e);
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-5">
      {list.map((e, i) => (
        <li key={e.id} className="relative">
          <span className={cn("absolute top-1 -left-[27px] size-3 rounded-full ring-4 ring-surface", i === 0 ? "bg-brand-500" : e.customerVisible ? "bg-slate-300" : "bg-amber-400")} />
          <p className="text-sm text-fg">{e.text}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(e.at)} · {e.actor}
            {audit && !e.customerVisible && <span className="ml-1.5 font-semibold text-amber-700 dark:text-amber-300">· internal</span>}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function OrderItemsList({ order, compact }: { order: Pick<BookOrder, "items">; compact?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {order.items.map((i) => (
        <li key={i.bookId} className={cn("flex items-center gap-3", compact ? "py-2.5" : "py-3.5")}>
          <SnapshotCover title={i.title} theme={i.theme} className={compact ? "w-9" : undefined} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{i.title}</p>
            <p className="text-xs text-slate-500">
              {[i.author, i.edition, i.language].filter(Boolean).join(" · ")}
              {i.isbn && <span className="hidden sm:inline"> · ISBN {i.isbn}</span>}
            </p>
            <p className="text-xs text-slate-500">
              {i.qty} × {formatINR(i.unitPrice)}
              {i.mrp > i.unitPrice && <span className="ml-1 line-through">{formatINR(i.mrp)}</span>}
            </p>
          </div>
          <p className="text-sm font-bold text-fg">{formatINR(i.qty * i.unitPrice)}</p>
        </li>
      ))}
    </ul>
  );
}

export function TotalsBlock({ subtotal, shipping, total, savings, freeThreshold }: { subtotal: number; shipping: number; total: number; savings?: number; freeThreshold?: number }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt className="text-slate-500">Item subtotal</dt>
        <dd className="font-semibold text-fg">{formatINR(subtotal)}</dd>
      </div>
      {!!savings && savings > 0 && (
        <div className="flex justify-between">
          <dt className="text-slate-500">You save (vs MRP)</dt>
          <dd className="font-semibold text-emerald-600 dark:text-emerald-400">−{formatINR(savings)}</dd>
        </div>
      )}
      <div className="flex flex-wrap justify-between">
        <dt className="text-slate-500">Shipping</dt>
        <dd className="font-semibold text-fg">{shipping === 0 ? <span className="text-emerald-600 dark:text-emerald-400">Free</span> : formatINR(shipping)}</dd>
        {freeThreshold !== undefined && shipping > 0 && subtotal < freeThreshold && (
          <dd className="mt-2 w-full rounded-lg bg-brand-50 dark:bg-brand-400/10 px-3 py-2 text-xs text-brand-800 dark:text-brand-200">Add {formatINR(freeThreshold - subtotal)} more for free shipping.</dd>
        )}
      </div>
      <div className="flex justify-between border-t border-line pt-3 text-base">
        <dt className="font-bold text-fg">Total payable</dt>
        <dd className="font-extrabold text-fg">{formatINR(total)}</dd>
      </div>
    </dl>
  );
}

export function AddressBlock({ address, className }: { address: AddressSnapshot; className?: string }) {
  return (
    <address className={cn("text-sm leading-relaxed text-slate-600 not-italic", className)}>
      <span className="font-semibold text-fg">{address.fullName}</span> · {address.mobile}
      <br />
      {address.line1}, {address.locality}
      <br />
      {address.city}, {address.state} — {address.pin}
      {address.instructions && <span className="mt-1 block text-xs text-slate-500">Note: {address.instructions}</span>}
    </address>
  );
}
