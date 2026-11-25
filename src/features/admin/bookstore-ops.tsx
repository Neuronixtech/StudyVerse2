"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  BarChart3,
  Bell,
  Boxes,
  CircleCheck,
  Clock,
  Download,
  IndianRupee,
  Inbox,
  PackageCheck,
  PackageX,
  PauseCircle,
  RotateCcw,
  ShoppingBag,
  Truck,
  Wallet,
} from "lucide-react";
import { OrderStatusBadge, PrimaryPhoto } from "@/components/bookstore/book-visuals";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardHeader, EmptyState, PageHeader, SimulatedNote, StatCard } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Segmented, Switch } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import {
  ALL_BOOK_PERMISSIONS,
  availableStock,
  BOOK_PERMISSION_LABEL,
  hasAnyBookPermission,
  hasBookPermission,
  RETURN_REASON_LABEL,
  reservationState,
} from "@/lib/bookstore";
import { markDelivered, updateBookPermissions, updateBookstoreSettings } from "@/lib/bookstore-store";
import { useSession } from "@/lib/hooks";
import type { BookOrder, BookPermission, BookstoreSettings } from "@/lib/types";
import { cn, DAY, formatDate, formatINR, formatShortDate, relativeTime } from "@/lib/utils";
import { Restricted } from "./admin-shell";

/* ------------------------------ Dashboard ------------------------------ */

export function BookstoreDashboard() {
  const { state, admin, now } = useSession();
  if (!admin || !hasAnyBookPermission(admin)) return <Restricted what="the bookstore" />;
  const s = state.bookstore;
  const orders = state.bookOrders;
  const verify = orders.filter((o) => o.status === "payment_verification").sort((a, b) => a.createdAt - b.createdAt);
  const awaitingPay = orders.filter((o) => o.status === "pending_payment" || o.status === "payment_rejected");
  const expired = awaitingPay.filter((o) => reservationState(o, now) === "expired");
  const toDispatch = orders.filter((o) => o.status === "processing" && !o.hold);
  const onHold = orders.filter((o) => o.status === "processing" && o.hold);
  const shipped = orders.filter((o) => o.status === "shipped");
  const published = state.books.filter((b) => b.status === "published");
  const withAvail = published.map((b) => ({ b, a: availableStock(b, orders, now) }));
  const low = withAvail.filter((x) => x.a > 0 && x.a <= s.lowStockThreshold);
  const out = withAvail.filter((x) => x.a <= 0);
  const returns = orders.filter((o) => o.returnRequest?.status === "requested");
  const cancels = orders.filter((o) => o.cancellation?.status === "requested");
  const newOrders = orders.filter((o) => now - o.createdAt < DAY);
  const name = (id: string) => state.learners.find((l) => l.id === id)?.name ?? "Customer";
  // Latest staff/system actions on orders plus catalog changes
  const activity = [
    ...orders.flatMap((o) => o.events.filter((e) => e.actor !== "Customer").map((e) => ({ id: e.id, at: e.at, actor: e.actor, text: `${o.number}: ${e.text}` }))),
    ...state.audit.filter((a) => a.ref && state.books.some((b) => b.id === a.ref)),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);

  const alerts: { tone: "red" | "amber" | "sky" | "brand"; icon: React.ReactNode; text: string; href: string }[] = [
    ...(verify.length ? [{ tone: "sky" as const, icon: <Wallet />, text: `${verify.length} payment submission${verify.length > 1 ? "s" : ""} awaiting verification`, href: "/admin/bookstore/orders" }] : []),
    ...(newOrders.length ? [{ tone: "brand" as const, icon: <ShoppingBag />, text: `${newOrders.length} new order${newOrders.length > 1 ? "s" : ""} in the last 24 hours`, href: "/admin/bookstore/orders" }] : []),
    ...(expired.length ? [{ tone: "amber" as const, icon: <Clock />, text: `${expired.length} expired stock reservation${expired.length > 1 ? "s" : ""} (no payment submitted)`, href: "/admin/bookstore/orders" }] : []),
    ...(returns.length ? [{ tone: "amber" as const, icon: <RotateCcw />, text: `${returns.length} return request${returns.length > 1 ? "s" : ""} to review`, href: "/admin/bookstore/returns" }] : []),
    ...(cancels.length ? [{ tone: "amber" as const, icon: <Ban />, text: `${cancels.length} cancellation request${cancels.length > 1 ? "s" : ""}`, href: "/admin/bookstore/returns" }] : []),
    ...(out.length ? [{ tone: "red" as const, icon: <PackageX />, text: `${out.length} published book${out.length > 1 ? "s" : ""} out of stock`, href: "/admin/bookstore/books" }] : []),
    ...(low.length ? [{ tone: "amber" as const, icon: <Boxes />, text: `${low.length} book${low.length > 1 ? "s" : ""} low on stock (≤ ${s.lowStockThreshold})`, href: "/admin/bookstore/books" }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Bookstore overview" description="Actions that need attention come first. Payment verification always means checking the real UPI/bank statement." actions={hasBookPermission(admin, "books.edit") ? <ButtonLink href="/admin/bookstore/books/new" variant="secondary">Add book</ButtonLink> : undefined} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 2xl:grid-cols-8">
        <StatCard label="Total orders" value={orders.length} icon={<ShoppingBag />} />
        <StatCard label="Awaiting payment" value={awaitingPay.length} icon={<Clock />} tone="amber" hint={`${expired.length} reservation(s) expired`} />
        <StatCard label="Payments to verify" value={verify.length} icon={<Wallet />} tone="sky" hint={verify[0] ? `Oldest ${relativeTime(verify[0].payments[verify[0].payments.length - 1].submittedAt, now)}` : "All clear"} />
        <StatCard label="Ready to process" value={toDispatch.length} icon={<PackageCheck />} tone="violet" />
        <StatCard label="On hold" value={onHold.length} icon={<PauseCircle />} tone="rose" />
        <StatCard label="Shipped / in transit" value={shipped.length} icon={<Truck />} tone="emerald" />
        <StatCard label="Low stock" value={low.length} icon={<Boxes />} tone="amber" />
        <StatCard label="Out of stock" value={out.length} icon={<PackageX />} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Payments awaiting verification" description="Oldest first — stock stays reserved and orders are never auto-cancelled while waiting." action={<Link href="/admin/bookstore/orders" className="text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">All orders</Link>} />
          {verify.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No payments waiting. Nice work.</p>
          ) : (
            <ul className="divide-y divide-line">
              {verify.slice(0, 6).map((o) => {
                const p = o.payments[o.payments.length - 1];
                return (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-fg">{o.number} · {name(o.learnerId)}</p>
                      <p className="text-xs text-slate-500">
                        {formatINR(p.amount)} via {p.method === "upi" ? "UPI" : "bank"} · ref <span className="font-mono">{p.reference}</span> · {relativeTime(p.submittedAt, now)}
                        {p.amount !== o.total && <span className="ml-1 font-semibold text-red-600 dark:text-red-400">· amount mismatch</span>}
                      </p>
                    </div>
                    <ButtonLink href={`/admin/bookstore/orders/${o.id}`} size="sm">Verify</ButtonLink>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Bell className="size-4 text-brand-600 dark:text-brand-400" /> Alerts</span>} description="Email alerts are a future setting (simulated)." />
          {alerts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No alerts.</p>
          ) : (
            <ul className="divide-y divide-line">
              {alerts.map((a) => (
                <li key={a.text}>
                  <Link href={a.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4", a.tone === "red" ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" : a.tone === "amber" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" : a.tone === "sky" ? "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400" : "bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300")}>{a.icon}</span>
                    <span className="flex-1 text-fg">{a.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Stock alerts" description={`Low-stock threshold: ${s.lowStockThreshold}`} action={<Link href="/admin/bookstore/books" className="text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">Inventory</Link>} />
          {low.length + out.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">All published books are well stocked.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...out, ...low].map(({ b, a }) => (
                <li key={b.id}>
                  <Link href={`/admin/bookstore/books/${b.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                    <PrimaryPhoto book={b} size="xs" className="w-8 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{b.title}</span>
                    <Badge tone={a <= 0 ? "red" : "amber"} size="xs">{a <= 0 ? "Out" : `${a} left`}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No recent bookstore activity.</p>
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((a) => (
                <li key={a.id} className="px-5 py-2.5">
                  <p className="text-sm text-fg">{a.text}</p>
                  <p className="text-xs text-slate-500">{a.actor} · {relativeTime(a.at, now)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Dispatch ------------------------------ */

export function DispatchPage() {
  const { state, admin, now } = useSession();
  const [tab, setTab] = useState<"ready" | "hold" | "transit">("ready");
  if (!admin || !hasAnyBookPermission(admin, ["dispatch.manage", "orders.process"])) return <Restricted what="dispatch" />;
  const canDispatch = hasBookPermission(admin, "dispatch.manage");
  const ready = state.bookOrders.filter((o) => o.status === "processing" && !o.hold).sort((a, b) => a.createdAt - b.createdAt);
  const hold = state.bookOrders.filter((o) => o.status === "processing" && o.hold);
  const transit = state.bookOrders.filter((o) => o.status === "shipped").sort((a, b) => (a.shipment?.dispatchedAt ?? 0) - (b.shipment?.dispatchedAt ?? 0));
  const list = tab === "ready" ? ready : tab === "hold" ? hold : transit;
  const name = (id: string) => state.learners.find((l) => l.id === id)?.name ?? "Customer";

  return (
    <div className="space-y-6">
      <PageHeader title="Dispatch" description="Pack and ship confirmed orders. Each order ships complete — no partial shipments. Courier and tracking details are entered manually." />
      <Tabs label="Dispatch queue" value={tab} onChange={setTab} items={[{ value: "ready", label: "Ready to ship", count: ready.length }, { value: "hold", label: "On hold", count: hold.length }, { value: "transit", label: "In transit", count: transit.length }]} />
      {list.length === 0 ? (
        <EmptyState icon={<Truck />} title="Nothing here" description={tab === "ready" ? "Confirmed orders appear here once payment is verified." : tab === "hold" ? "No orders are on hold." : "No parcels in transit."} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-fg">{o.number} · {name(o.learnerId)}</p>
                  <p className="text-xs text-slate-500">{o.address.city}, {o.address.state} {o.address.pin}</p>
                </div>
                <OrderStatusBadge status={o.status} size="xs" />
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {o.items.map((i) => (
                  <li key={i.bookId} className="flex justify-between gap-3"><span className="truncate text-slate-700">{i.title}</span><span className="font-semibold text-fg">× {i.qty}</span></li>
                ))}
              </ul>
              {o.hold && <p className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">{o.hold.reason}</p>}
              {o.shipment && <p className="mt-3 text-xs text-slate-600">{o.shipment.courier} · <span className="font-mono">{o.shipment.tracking}</span> · shipped {relativeTime(o.shipment.dispatchedAt, now)}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href={`/admin/bookstore/orders/${o.id}`} size="sm" variant={tab === "ready" ? "primary" : "secondary"}>{tab === "ready" ? "Record dispatch" : "Open order"}</ButtonLink>
                {tab === "transit" && canDispatch && <Button size="sm" variant="secondary" onClick={() => { markDelivered(o.id, admin.id); toast({ title: `${o.number} delivered`, simulated: true }); }}><CircleCheck /> Mark delivered</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Returns & refunds --------------------------- */

export function ReturnsPage() {
  const { state, admin, now } = useSession();
  const [tab, setTab] = useState<"returns" | "cancellations" | "refunds" | "resolved">("returns");
  if (!admin || !hasAnyBookPermission(admin, ["returns.review", "refunds.record", "cancellations.decide"])) return <Restricted what="returns and refunds" />;
  const name = (id: string) => state.learners.find((l) => l.id === id)?.name ?? "Customer";
  const returns = state.bookOrders.filter((o) => o.returnRequest && (o.returnRequest.status === "requested" || o.returnRequest.status === "approved"));
  const cancels = state.bookOrders.filter((o) => o.cancellation?.status === "requested");
  const refunds = state.bookOrders.filter((o) => o.refunds.some((r) => r.status === "pending") || (o.status === "cancelled" && o.payments.some((p) => p.status === "approved") && o.refunds.length === 0) || (o.paymentDifference ?? 0) < 0);
  const resolved = state.bookOrders.filter((o) => o.returnRequest && (o.returnRequest.status === "resolved" || o.returnRequest.status === "rejected"));
  const list: BookOrder[] = tab === "returns" ? returns : tab === "cancellations" ? cancels : tab === "refunds" ? refunds : resolved;

  return (
    <div className="space-y-6">
      <PageHeader title="Returns & refunds" description={`Damaged, defective or incorrect books can be reported within ${state.bookstore.returnWindowDays} days of delivery. Refunds are sent outside StudyVerse and recorded here.`} />
      <Tabs label="Queue" value={tab} onChange={setTab} items={[{ value: "returns", label: "Return requests", count: returns.length }, { value: "cancellations", label: "Cancellation requests", count: cancels.length }, { value: "refunds", label: "Refunds to record", count: refunds.length }, { value: "resolved", label: "Closed", count: resolved.length }]} />
      {list.length === 0 ? (
        <EmptyState icon={<Inbox />} title="Queue is empty" description="Nothing to review right now." />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((o) => (
              <li key={o.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-fg">{o.number}</p>
                    <OrderStatusBadge status={o.status} size="xs" />
                    {o.returnRequest && tab !== "cancellations" && <Badge tone={o.returnRequest.status === "requested" ? "amber" : o.returnRequest.status === "approved" ? "violet" : o.returnRequest.status === "resolved" ? "green" : "red"} size="xs">Return {o.returnRequest.status}</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {name(o.learnerId)} ·{" "}
                    {tab === "cancellations"
                      ? `“${o.cancellation?.reason}” · ${relativeTime(o.cancellation!.requestedAt, now)}`
                      : tab === "refunds"
                        ? o.refunds.some((r) => r.status === "pending") ? `Pending refund ${formatINR(o.refunds.find((r) => r.status === "pending")!.amount)}` : (o.paymentDifference ?? 0) < 0 ? `${formatINR(-(o.paymentDifference ?? 0))} owed after order edit` : "Cancelled after payment — no refund recorded"
                        : `${RETURN_REASON_LABEL[o.returnRequest!.reason]} · ${o.returnRequest!.preference} preferred · ${relativeTime(o.returnRequest!.requestedAt, now)}`}
                  </p>
                </div>
                <ButtonLink href={`/admin/bookstore/orders/${o.id}`} size="sm" variant={tab === "resolved" ? "secondary" : "primary"}>{tab === "resolved" ? "View" : "Review"}</ButtonLink>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------ Reports ------------------------------ */

export function ReportsPage() {
  const { state, admin, now } = useSession();
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("30");
  if (!admin || !hasBookPermission(admin, "reports.view")) return <Restricted what="bookstore reports" />;
  const from = range === "all" ? 0 : now - Number(range) * DAY;
  const inRange = state.bookOrders.filter((o) => o.createdAt >= from);
  const approved = state.bookOrders.flatMap((o) => o.payments.filter((p) => p.status === "approved" && (p.decidedAt ?? 0) >= from).map((p) => ({ o, p })));
  const refunds = state.bookOrders.flatMap((o) => o.refunds.filter((r) => r.status === "completed" && (r.completedAt ?? r.recordedAt) >= from));
  const gross = approved.reduce((a, x) => a + x.p.amount, 0);
  const refundTotal = refunds.reduce((a, r) => a + r.amount, 0);
  const payments = state.bookOrders.flatMap((o) => o.payments.filter((p) => p.submittedAt >= from));
  const pendingPay = payments.filter((p) => p.status === "submitted");
  const rejectedPay = payments.filter((p) => p.status === "rejected");

  const sold = new Map<string, { title: string; qty: number; revenue: number }>();
  for (const o of state.bookOrders.filter((x) => x.payments.some((p) => p.status === "approved" && (p.decidedAt ?? 0) >= from))) {
    for (const i of o.items) {
      const cur = sold.get(i.bookId) ?? { title: i.title, qty: 0, revenue: 0 };
      sold.set(i.bookId, { title: i.title, qty: cur.qty + i.qty, revenue: cur.revenue + i.qty * i.unitPrice });
    }
  }
  const best = [...sold.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);
  const published = state.books.filter((b) => b.status === "published").map((b) => ({ b, a: availableStock(b, state.bookOrders, now) }));
  const low = published.filter((x) => x.a > 0 && x.a <= state.bookstore.lowStockThreshold);
  const out = published.filter((x) => x.a <= 0);

  const days = range === "all" ? 30 : Math.min(Number(range), 30);
  const startOfDay = (ms: number) => ms - (((ms + 5.5 * 3_600_000) % DAY) + DAY) % DAY;
  const today = startOfDay(now);
  const series = Array.from({ length: days }, (_, i) => {
    const d = today - (days - 1 - i) * DAY;
    return { d, v: approved.filter((x) => (x.p.decidedAt ?? 0) >= d && (x.p.decidedAt ?? 0) < d + DAY).reduce((a, x) => a + x.p.amount, 0) };
  });
  const peak = Math.max(1, ...series.map((x) => x.v));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookstore reports"
        description="Figures are computed from mock orders in this browser."
        actions={
          <>
            <Segmented label="Date range" className="[&_button]:whitespace-nowrap" value={range} onChange={setRange} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }, { value: "all", label: "All time" }]} />
            <Button variant="secondary" disabled title="Export isn't available in the prototype"><Download /> Export CSV</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Net revenue" value={formatINR(gross - refundTotal)} icon={<IndianRupee />} hint={`${formatINR(gross)} confirmed − ${formatINR(refundTotal)} refunded`} />
        <StatCard label="Orders placed" value={inRange.length} icon={<ShoppingBag />} tone="sky" />
        <StatCard label="Payments" value={`${approved.length} / ${pendingPay.length} / ${rejectedPay.length}`} icon={<Wallet />} tone="violet" hint="Confirmed / pending / rejected" />
        <StatCard label="Cancelled · returned" value={`${inRange.filter((o) => o.status === "cancelled").length} · ${inRange.filter((o) => o.returnRequest).length}`} icon={<RotateCcw />} tone="rose" hint={`${refunds.length} refund(s) completed`} />
      </div>
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><BarChart3 className="size-4 text-brand-600 dark:text-brand-400" /> Confirmed sales by day</span>} description={range === "all" ? "Last 30 days shown" : `Last ${days} days`} />
        <div className="px-5 pt-5 pb-4">
          <div className="flex h-48 items-end gap-1" role="img" aria-label={`Daily confirmed sales for the last ${days} days, peak ${formatINR(peak)}`}>
            {series.map((x) => (
              <div key={x.d} className="group relative flex h-full flex-1 items-end" title={`${formatDate(x.d)}: ${formatINR(x.v)}`}>
                <div className="w-full rounded-t bg-brand-500 transition-colors group-hover:bg-brand-600" style={{ height: `${(x.v / peak) * 100}%`, minHeight: x.v ? 4 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{formatShortDate(series[0].d)}</span>
            <span>{formatShortDate(series[series.length - 1].d)}</span>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Best-selling books" description="By copies in confirmed orders" />
          {best.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No confirmed sales in this range.</p> : (
            <ol className="divide-y divide-line">
              {best.map((b, i) => (
                <li key={b.title} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-fg">{b.title}</span>
                  <span className="text-slate-500">{b.qty} sold</span>
                  <span className="w-20 text-right font-semibold text-fg">{formatINR(b.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card>
          <CardHeader title="Stock health" description={`${low.length} low · ${out.length} out of stock`} />
          <ul className="divide-y divide-line">
            {[...out, ...low].map(({ b, a }) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <Link href={`/admin/bookstore/books/${b.id}`} className="min-w-0 truncate font-semibold text-fg hover:text-brand-700 dark:hover:text-brand-300">{b.title}</Link>
                <Badge tone={a <= 0 ? "red" : "amber"} size="xs">{a <= 0 ? "Out of stock" : `${a} available`}</Badge>
              </li>
            ))}
            {low.length + out.length === 0 && <li className="p-6 text-center text-sm text-slate-500">All books healthy.</li>}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Payment outcomes" description="Submissions in range" />
        <dl className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          {[
            ["Confirmed", approved.length, approved.reduce((a, x) => a + x.p.amount, 0), "text-emerald-600 dark:text-emerald-400"],
            ["Pending verification", pendingPay.length, pendingPay.reduce((a, p) => a + p.amount, 0), "text-sky-600 dark:text-sky-400"],
            ["Rejected", rejectedPay.length, rejectedPay.reduce((a, p) => a + p.amount, 0), "text-red-600 dark:text-red-400"],
          ].map(([k, n, amt, cls]) => (
            <div key={String(k)} className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className={cn("text-2xl font-extrabold", String(cls))}>{n}</dd>
              <dd className="text-xs text-slate-500">{formatINR(Number(amt))}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

/* ------------------------------ Settings ------------------------------ */

export function BookstoreSettingsPage() {
  const { state, admin } = useSession();
  if (!admin) return null;
  if (admin.role !== "owner") return <Restricted what="bookstore settings and staff permissions" ownerOnly />;
  return (
    <div className="space-y-6">
      <PageHeader title="Store settings" description="Owner-only bookstore configuration." />
      <SettingsForm key={JSON.stringify(state.bookstore)} settings={state.bookstore} adminId={admin.id} />
      <PermissionsMatrix />
    </div>
  );
}

function SettingsForm({ settings, adminId }: { settings: BookstoreSettings; adminId: string }) {
  const [v, setV] = useState(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(v) !== JSON.stringify(settings);
  const num = (k: keyof BookstoreSettings, label: string, hint?: string) => (
    <Field label={label} error={errors[k]} hint={hint}>
      {(p) => <Input {...p} inputMode="numeric" value={String(v[k])} onChange={(e) => setV({ ...v, [k]: Number(e.target.value.replace(/\D/g, "")) || 0 })} />}
    </Field>
  );
  const text = (k: keyof BookstoreSettings, label: string, mono?: boolean) => (
    <Field label={label} error={errors[k]}>{(p) => <Input {...p} className={mono ? "font-mono" : undefined} value={String(v[k])} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}</Field>
  );
  const save = () => {
    const errs: Record<string, string> = {};
    if (v.lowStockThreshold < 1) errs.lowStockThreshold = "Must be at least 1";
    if (v.reservationHours < 1) errs.reservationHours = "Must be at least 1 hour";
    if (!v.upiId.includes("@")) errs.upiId = "Enter a valid UPI ID";
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.ifsc)) errs.ifsc = "Enter a valid IFSC (e.g. DEMO0001234)";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    updateBookstoreSettings(v, adminId);
    toast({ title: "Bookstore settings saved", description: "Shipping changes apply to new orders.", simulated: true });
  };
  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Shipping & inventory" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            {num("shippingFee", "Flat shipping fee (₹)")}
            {num("freeShippingThreshold", "Free shipping above (₹)")}
            {num("lowStockThreshold", "Low-stock threshold (copies)", "Default 5")}
            {num("reservationHours", "Stock reservation (hours)", "Working assumption: starts at order creation")}
            {num("returnWindowDays", "Return window (days after delivery)")}
            {text("deliveryEstimate", "Delivery estimate shown to customers")}
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-slate-500">Location-based shipping and PIN-code serviceability are not part of Phase 1.</p>
        </Card>
        <Card>
          <CardHeader title="Payment instructions" description="Shown on the order payment page." />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            {text("upiId", "UPI ID", true)}
            {text("payeeName", "UPI payee name")}
            {text("bankName", "Bank")}
            {text("accountName", "Account name")}
            {text("accountNumber", "Account number", true)}
            {text("ifsc", "IFSC", true)}
          </div>
          <div className="border-t border-line p-5">
            <Switch checked={v.emailAlerts} onChange={(x) => setV({ ...v, emailAlerts: x })} label="Email alerts to admins (future)" description="Stored as a preference only — no email is sent in the prototype." />
          </div>
        </Card>
      </div>
      <div className="flex items-center justify-end gap-3">
        <SimulatedNote>Saved to this browser only.</SimulatedNote>
        <Button disabled={!dirty} onClick={save}>Save settings</Button>
      </div>
    </>
  );
}

function PermissionsMatrix() {
  const { state, admin } = useSession();
  const staff = state.admins.filter((a) => a.role === "staff");
  const [draft, setDraft] = useState<Record<string, BookPermission[]>>(() => Object.fromEntries(staff.map((a) => [a.id, a.bookPermissions ?? []])));
  if (!admin) return null;
  const toggle = (id: string, p: BookPermission) => setDraft((d) => ({ ...d, [id]: (d[id] ?? []).includes(p) ? d[id].filter((x) => x !== p) : [...(d[id] ?? []), p] }));
  const changed = staff.filter((a) => JSON.stringify([...(draft[a.id] ?? [])].sort()) !== JSON.stringify([...(a.bookPermissions ?? [])].sort()));
  return (
    <Card>
      <CardHeader title="Staff bookstore permissions" description="Owners always have full access. Store settings remain owner-only." action={<Button size="sm" disabled={!changed.length} onClick={() => { changed.forEach((a) => updateBookPermissions(a.id, draft[a.id] ?? [], admin.id)); toast({ title: "Permissions updated", description: changed.map((a) => a.name).join(", "), simulated: true }); }}>Save permissions</Button>} />
      {staff.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">No staff admins yet. Invite staff from Admins &amp; staff.</p>
      ) : (
        <>
          <div className="relative hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="sticky left-0 bg-slate-50 px-4 py-2.5 text-left font-semibold">Permission</th>
                  {staff.map((a) => <th key={a.id} className="px-3 py-2.5 text-center font-semibold">{a.name}{a.status === "invited" && <span className="block text-[10px] font-normal">invited</span>}</th>)}
                </tr>
              </thead>
              <tbody>
                {ALL_BOOK_PERMISSIONS.map((p) => (
                  <tr key={p} className="border-t border-line">
                    <td className="sticky left-0 bg-surface px-4 py-2.5 font-medium text-fg">{BOOK_PERMISSION_LABEL[p]}</td>
                    {staff.map((a) => (
                      <td key={a.id} className="px-3 py-2.5 text-center">
                        <input type="checkbox" checked={(draft[a.id] ?? []).includes(p)} onChange={() => toggle(a.id, p)} className="size-4 accent-brand-600" aria-label={`${BOOK_PERMISSION_LABEL[p]} for ${a.name}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-5 p-5 md:hidden">
            {staff.map((a) => (
              <div key={a.id}>
                <p className="mb-2 text-sm font-bold text-fg">{a.name}</p>
                <div className="space-y-2">
                  {ALL_BOOK_PERMISSIONS.map((p) => <Checkbox key={p} checked={(draft[a.id] ?? []).includes(p)} onChange={() => toggle(a.id, p)} label={BOOK_PERMISSION_LABEL[p]} />)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {changed.length > 0 && <Callout tone="warning" className="m-5 mt-0" icon={<AlertTriangle />}>Unsaved permission changes for {changed.map((a) => a.name).join(", ")}.</Callout>}
    </Card>
  );
}

