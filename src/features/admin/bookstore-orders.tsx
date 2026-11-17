"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Camera,
  CircleCheck,
  CircleX,
  Copy,
  FileImage,
  Lock,
  MapPin,
  MessageSquarePlus,
  Minus,
  PackageCheck,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { OrderStatusBadge, SnapshotCover } from "@/components/bookstore/book-visuals";
import { AddressBlock, OrderItemsList, OrderTimeline, TotalsBlock } from "@/components/bookstore/order-ui";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar, Callout, Card, CardHeader, EmptyState, ErrorState, PageHeader, SimulatedNote, Skeleton } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Segmented, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import {
  amountPaid,
  availableStock,
  COURIERS,
  hasAnyBookPermission,
  hasBookPermission,
  INDIAN_STATES,
  isEditable,
  isPaid,
  latestPayment,
  RETURN_REASON_LABEL,
  reservationState,
  totalsFor,
} from "@/lib/bookstore";
import {
  addOrderNote,
  addTrackingUpdate,
  adminCancelUnpaidOrder,
  approveBookPayment,
  completeRefund,
  decideCancellation,
  dispatchOrder,
  editOrder,
  markDelivered,
  recordRefund,
  rejectBookPayment,
  resolveReturn,
  reviewReturn,
  sendReplacement,
  setOrderHold,
  settleAdditionalPayment,
} from "@/lib/bookstore-store";
import { useSession, useSimulatedLoad } from "@/lib/hooks";
import type { AddressSnapshot, BookOrder, PaymentMethod, Refund } from "@/lib/types";
import { cn, formatDateTime, formatINR, relativeTime } from "@/lib/utils";
import { Restricted } from "./admin-shell";

/* ------------------------------ Orders list ------------------------------ */

type OrderTab = "action" | "pending_payment" | "payment_verification" | "processing" | "shipped" | "delivered" | "closed" | "all";

export function needsAction(o: BookOrder, now: number): string | null {
  if (o.status === "payment_verification") return "Verify payment";
  if (o.cancellation?.status === "requested") return "Cancellation request";
  if (o.returnRequest?.status === "requested") return "Return request";
  if (o.returnRequest?.status === "approved") return "Complete return";
  if (o.refunds.some((r) => r.status === "pending")) return "Refund pending";
  if (o.paymentDifference) return "Payment difference";
  if (o.status === "pending_payment" && reservationState(o, now) === "expired") return "Reservation expired";
  return null;
}

export function OrdersAdminPage() {
  const { state, admin, now } = useSession();
  const [tab, setTab] = useState<OrderTab>("action");
  const [q, setQ] = useState("");
  const load = useSimulatedLoad("admin-book-orders");
  const learnerName = (id: string) => state.learners.find((l) => l.id === id)?.name ?? "Unknown";

  const filtered = useMemo(() => {
    const nameOf = (id: string) => state.learners.find((l) => l.id === id)?.name ?? "";
    const needle = q.trim().toLowerCase();
    return state.bookOrders
      .filter((o) => {
        if (needle && !`${o.number} ${nameOf(o.learnerId)} ${o.address.mobile} ${o.payments.map((p) => p.reference).join(" ")}`.toLowerCase().includes(needle)) return false;
        if (tab === "all") return true;
        if (tab === "action") return !!needsAction(o, now);
        if (tab === "closed") return ["cancelled", "returned", "refunded"].includes(o.status);
        if (tab === "pending_payment") return o.status === "pending_payment" || o.status === "payment_rejected";
        return o.status === tab;
      })
      .sort((a, b) => (tab === "action" || tab === "payment_verification" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));
  }, [state.bookOrders, state.learners, q, tab, now]);

  if (!admin || !hasAnyBookPermission(admin, ["payments.verify", "orders.process", "cancellations.decide", "dispatch.manage", "returns.review", "refunds.record"])) return <Restricted what="bookstore orders" />;
  const count = (t: OrderTab) =>
    state.bookOrders.filter((o) =>
      t === "all" ? true : t === "action" ? !!needsAction(o, now) : t === "closed" ? ["cancelled", "returned", "refunded"].includes(o.status) : t === "pending_payment" ? o.status === "pending_payment" || o.status === "payment_rejected" : o.status === t,
    ).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Orders & payments" description="Payments awaiting verification are listed first. Verify each transfer in the actual UPI/bank account before approving." />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <Tabs
            label="Order status"
            variant="pill"
            value={tab}
            onChange={setTab}
            items={[
              { value: "action", label: "Needs action", count: count("action") },
              { value: "payment_verification", label: "Verify payment", count: count("payment_verification") },
              { value: "pending_payment", label: "Awaiting payment", count: count("pending_payment") },
              { value: "processing", label: "Processing", count: count("processing") },
              { value: "shipped", label: "Shipped", count: count("shipped") },
              { value: "delivered", label: "Delivered", count: count("delivered") },
              { value: "closed", label: "Closed", count: count("closed") },
              { value: "all", label: "All", count: count("all") },
            ]}
          />
          <label className="relative max-w-sm">
            <span className="sr-only">Search orders</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number, customer, mobile or payment ref" className="h-10 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm text-fg outline-none focus:border-brand-500 focus:shadow-ring" />
          </label>
        </div>
        {load.status === "loading" ? (
          <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : load.status === "error" ? (
          <div className="p-4"><ErrorState onRetry={load.retry} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-4"><EmptyState className="border-0" icon={<ShoppingBag />} title={tab === "action" ? "Nothing needs your attention" : "No orders here"} description="New orders and payment submissions appear here." /></div>
        ) : (
          <>
            <div className="relative hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Order</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Customer</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Items</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Total</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const action = needsAction(o, now);
                    return (
                      <tr key={o.id} className="border-t border-line hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <Link href={`/admin/bookstore/orders/${o.id}`} className="font-bold text-fg hover:text-brand-700 dark:hover:text-brand-300">{o.number}</Link>
                          <p className="text-xs text-slate-500" title={formatDateTime(o.createdAt)}>{relativeTime(o.createdAt, now)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-fg">{learnerName(o.learnerId)}</p>
                          <p className="text-xs text-slate-500">{o.address.city}, {o.address.state}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{o.items.reduce((a, i) => a + i.qty, 0)} book(s)</td>
                        <td className="px-3 py-3 font-semibold text-fg">{formatINR(o.total)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <OrderStatusBadge status={o.status} size="xs" />
                            {o.hold && <Badge tone="amber" size="xs">On hold</Badge>}
                            {action && action !== "Verify payment" && <Badge tone="red" size="xs">{action}</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ButtonLink href={`/admin/bookstore/orders/${o.id}`} size="sm" variant={action ? "primary" : "secondary"}>
                            {action === "Verify payment" ? "Verify" : action ? "Review" : "Open"}
                          </ButtonLink>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line lg:hidden">
              {filtered.map((o) => {
                const action = needsAction(o, now);
                return (
                  <li key={o.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-fg">{o.number} · {formatINR(o.total)}</p>
                        <p className="truncate text-xs text-slate-500">{learnerName(o.learnerId)} · {relativeTime(o.createdAt, now)}</p>
                      </div>
                      <ButtonLink href={`/admin/bookstore/orders/${o.id}`} size="sm" variant={action ? "primary" : "secondary"}>{action === "Verify payment" ? "Verify" : action ? "Review" : "Open"}</ButtonLink>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <OrderStatusBadge status={o.status} size="xs" />
                      {o.hold && <Badge tone="amber" size="xs">On hold</Badge>}
                      {action && action !== "Verify payment" && <Badge tone="red" size="xs">{action}</Badge>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ Order detail ------------------------------ */

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-semibold text-fg">{v}</dd>
    </div>
  );
}

function NoPerm({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
      <Lock className="size-3.5" /> {text}
    </p>
  );
}

export function OrderAdminDetail({ orderId }: { orderId: string }) {
  const { state, admin, now } = useSession();
  const [modal, setModal] = useState<null | "approve" | "reject" | "hold" | "dispatch" | "update" | "cancelUnpaid" | "decideCancel" | "reviewReturn" | "replacement" | "refund" | "edit" | "note" | "extraPayment">(null);
  const [refundContext, setRefundContext] = useState<Refund["context"]>("return");
  const [completing, setCompleting] = useState<Refund | null>(null);
  if (!admin || !hasAnyBookPermission(admin)) return <Restricted what="bookstore orders" />;
  const order = state.bookOrders.find((o) => o.id === orderId);
  if (!order) return <EmptyState icon={<ShoppingBag />} title="Order not found" action={<ButtonLink href="/admin/bookstore/orders">Back to orders</ButtonLink>} />;

  const can = {
    verify: hasBookPermission(admin, "payments.verify"),
    process: hasBookPermission(admin, "orders.process"),
    dispatch: hasBookPermission(admin, "dispatch.manage"),
    cancel: hasBookPermission(admin, "cancellations.decide"),
    returns: hasBookPermission(admin, "returns.review"),
    refunds: hasBookPermission(admin, "refunds.record"),
  };
  const customer = state.learners.find((l) => l.id === order.learnerId);
  const pay = latestPayment(order);
  const res = reservationState(order, now);
  const paid = amountPaid(order);
  const close = () => setModal(null);

  return (
    <div className="space-y-6">
      <Link href="/admin/bookstore/orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-fg"><ArrowLeft className="size-4" /> Orders</Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold">Order {order.number}</h1>
            <OrderStatusBadge status={order.status} />
            {order.hold && <Badge tone="amber">On hold</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">Placed {formatDateTime(order.createdAt)} · {customer?.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can.process && isEditable(order) && <Button variant="secondary" onClick={() => setModal("edit")}><Pencil /> Edit order</Button>}
          {can.process && order.status === "processing" && (order.hold ? <Button variant="secondary" onClick={() => { setOrderHold(order.id, null, admin.id); toast({ title: "Hold released", simulated: true }); }}><PlayCircle /> Release hold</Button> : <Button variant="secondary" onClick={() => setModal("hold")}><PauseCircle /> Put on hold</Button>)}
          {can.process && (order.status === "pending_payment" || order.status === "payment_rejected") && <Button variant="secondary" className="text-red-600 dark:text-red-400" onClick={() => setModal("cancelUnpaid")}><Ban /> Cancel order</Button>}
          <Button variant="ghost" onClick={() => setModal("note")}><MessageSquarePlus /> Add note</Button>
        </div>
      </div>

      {/* Attention banners */}
      {order.status === "pending_payment" && res === "active" && <Callout tone="info">Awaiting customer payment. Stock reserved until {formatDateTime(order.reservationExpiresAt)}.</Callout>}
      {order.status === "pending_payment" && res === "expired" && (
        <Callout tone="warning" title="Reservation expired without a payment submission">
          Stock was released on {formatDateTime(order.reservationExpiresAt)}. Follow up with the customer or cancel the order.
        </Callout>
      )}
      {order.status === "payment_rejected" && <Callout tone="danger">Payment rejected. The customer can resubmit against this order{res === "active" ? ` until ${formatDateTime(order.reservationExpiresAt)} (reservation working assumption)` : " — reservation has expired"}.</Callout>}
      {order.hold && <Callout tone="warning" icon={<PauseCircle />} title="Order on hold">{order.hold.reason} <span className="text-xs opacity-80">— {order.hold.by}, {formatDateTime(order.hold.at)}</span></Callout>}
      {order.paymentDifference && (
        <Callout
          tone="warning"
          icon={<TriangleAlert />}
          title={order.paymentDifference > 0 ? `${formatINR(order.paymentDifference)} additional payment due` : `${formatINR(-order.paymentDifference)} must be refunded`}
          action={
            order.paymentDifference > 0
              ? can.verify && <Button size="sm" onClick={() => setModal("extraPayment")}>Record payment</Button>
              : can.refunds && <Button size="sm" onClick={() => { setRefundContext("adjustment"); setModal("refund"); }}>Record refund</Button>
          }
        >
          The order was edited after payment ({formatINR(paid)} paid, total now {formatINR(order.total)}). Resolve the difference manually — the payment amount is never changed silently.
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Payment verification */}
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Wallet className="size-4 text-brand-600 dark:text-brand-400" /> Payment</span>} description={isPaid(order) ? `Confirmed · ${formatINR(paid)} received` : "Manual UPI / bank transfer"} />
            {order.status === "payment_verification" && pay ? (
              <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
                <dl className="space-y-2.5">
                  <Row k="Method" v={pay.method === "upi" ? "UPI" : "Bank transfer"} />
                  <Row k="Transaction reference" v={<button type="button" className="inline-flex items-center gap-1.5 font-mono hover:text-brand-700 dark:hover:text-brand-300" onClick={() => navigator.clipboard?.writeText(pay.reference).then(() => toast({ title: "Reference copied", tone: "info" }))}>{pay.reference} <Copy className="size-3.5" /></button>} />
                  <Row k="Amount submitted" v={<span className={cn(pay.amount !== order.total && "text-red-600 dark:text-red-400")}>{formatINR(pay.amount)}{pay.amount !== order.total && ` (total ${formatINR(order.total)})`}</span>} />
                  <Row k="Submitted" v={formatDateTime(pay.submittedAt)} />
                  <Row k="Waiting" v={relativeTime(Math.min(pay.submittedAt, now), now).replace(" ago", "")} />
                </dl>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Screenshot (supporting only — not proof)</p>
                  {pay.screenshotName ? (
                    <div className="mt-2 grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line-strong bg-slate-50 p-4 text-center">
                      <div><FileImage className="mx-auto size-7 text-slate-400" /><p className="mt-1 text-sm font-semibold text-fg">{pay.screenshotName}</p><p className="text-xs text-slate-500">Preview unavailable in prototype</p></div>
                    </div>
                  ) : (
                    <p className="mt-2 rounded-xl border border-dashed border-line-strong bg-slate-50 p-5 text-center text-sm text-slate-500">No screenshot attached</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  {pay.amount !== order.total && <Callout tone="warning" className="mb-3">Submitted amount doesn&apos;t match the order total. Approve only if the account shows the full amount.</Callout>}
                  {can.verify ? (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setModal("approve")} className="bg-emerald-600 hover:bg-emerald-700"><CircleCheck /> Approve payment</Button>
                      <Button variant="secondary" className="text-red-600 dark:text-red-400" onClick={() => setModal("reject")}><CircleX /> Reject</Button>
                    </div>
                  ) : (
                    <NoPerm text="Verifying payments requires the “Verify payments” permission" />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5 text-sm text-slate-500">{order.payments.length === 0 ? "The customer hasn't submitted payment details yet." : null}</div>
            )}
            {order.payments.length > 0 && (
              <div className="border-t border-line">
                <p className="px-5 pt-4 text-xs font-bold tracking-wide text-slate-500 uppercase">Payment audit</p>
                <ul className="divide-y divide-line">
                  {[...order.payments].reverse().map((p) => (
                    <li key={p.id} className="flex flex-wrap items-start gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-fg">{formatINR(p.amount)} · {p.method === "upi" ? "UPI" : "Bank"} · <span className="font-mono">{p.reference}</span></p>
                        <p className="text-xs text-slate-500">Submitted {formatDateTime(p.submittedAt)}{p.screenshotName && ` · ${p.screenshotName}`}</p>
                        {p.decidedBy && <p className="text-xs text-slate-500">{p.status === "approved" ? "Approved" : "Rejected"} by {p.decidedBy} · {formatDateTime(p.decidedAt!)}</p>}
                        {p.rejectionReason && <p className="mt-1 rounded-lg bg-red-50 dark:bg-red-500/10 px-2.5 py-1.5 text-xs text-red-800 dark:text-red-200">{p.rejectionReason}</p>}
                      </div>
                      <Badge tone={p.status === "approved" ? "green" : p.status === "rejected" ? "red" : "sky"} size="xs" dot>{p.status === "submitted" ? "Awaiting review" : p.status}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Cancellation request */}
          {order.cancellation && (order.cancellation.status === "requested" || order.cancellation.decidedBy !== "Customer") && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Ban className="size-4 text-brand-600 dark:text-brand-400" /> Cancellation</span>} action={<Badge tone={order.cancellation.status === "requested" ? "amber" : order.cancellation.status === "approved" ? "green" : "red"} dot>{order.cancellation.status}</Badge>} />
              <div className="space-y-3 p-5 text-sm">
                <p><span className="text-slate-500">Reason:</span> {order.cancellation.reason}</p>
                <p className="text-xs text-slate-500">Requested {formatDateTime(order.cancellation.requestedAt)}{order.cancellation.decidedBy && ` · decided by ${order.cancellation.decidedBy}`}</p>
                {order.cancellation.note && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs">{order.cancellation.note}</p>}
                {order.cancellation.status === "requested" && (can.cancel ? <Button size="sm" onClick={() => setModal("decideCancel")}>Review request</Button> : <NoPerm text="Requires “Approve/reject cancellations”" />)}
              </div>
            </Card>
          )}

          {/* Return request */}
          {order.returnRequest && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><RotateCcw className="size-4 text-brand-600 dark:text-brand-400" /> Return / replacement</span>} action={<Badge tone={order.returnRequest.status === "requested" ? "amber" : order.returnRequest.status === "rejected" ? "red" : order.returnRequest.status === "resolved" ? "green" : "violet"} dot>{order.returnRequest.status}</Badge>} />
              <div className="space-y-3 p-5 text-sm">
                <p><strong className="text-fg">{RETURN_REASON_LABEL[order.returnRequest.reason]}</strong> · customer prefers <strong className="text-fg">{order.returnRequest.preference}</strong></p>
                <p className="text-slate-600">{order.returnRequest.details}</p>
                {order.returnRequest.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {order.returnRequest.photos.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700"><Camera className="size-3.5" /> {p}</span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500">Requested {formatDateTime(order.returnRequest.requestedAt)} · delivered {order.shipment?.deliveredAt ? formatDateTime(order.shipment.deliveredAt) : "—"}</p>
                {order.returnRequest.decisionNote && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><strong>{order.returnRequest.decidedBy}:</strong> {order.returnRequest.decisionNote}</p>}
                {order.returnRequest.replacement && <p className="text-xs">Replacement: {order.returnRequest.replacement.courier} · <span className="font-mono">{order.returnRequest.replacement.tracking}</span> · {formatDateTime(order.returnRequest.replacement.dispatchedAt)}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {order.returnRequest.status === "requested" && (can.returns ? <Button size="sm" onClick={() => setModal("reviewReturn")}>Review request</Button> : <NoPerm text="Requires “Review & approve returns”" />)}
                  {order.returnRequest.status === "approved" && !order.returnRequest.replacement && can.dispatch && <Button size="sm" variant="secondary" onClick={() => setModal("replacement")}><Truck /> Send replacement</Button>}
                  {order.returnRequest.status === "approved" && can.refunds && <Button size="sm" variant="secondary" onClick={() => { setRefundContext("return"); setModal("refund"); }}><Wallet /> Record refund</Button>}
                  {order.returnRequest.status === "approved" && can.returns && (order.returnRequest.replacement || order.refunds.some((r) => r.context === "return")) && <Button size="sm" onClick={() => { resolveReturn(order.id, admin.id); toast({ title: "Return resolved", simulated: true }); }}><CircleCheck /> Mark resolved</Button>}
                </div>
              </div>
            </Card>
          )}

          {/* Fulfilment */}
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Truck className="size-4 text-brand-600 dark:text-brand-400" /> Fulfilment</span>} />
            <div className="p-5 text-sm">
              {order.status === "processing" && !order.shipment && (
                order.hold ? <p className="text-slate-500">Release the hold before dispatching. Partial shipments aren&apos;t supported — the whole order ships together.</p>
                  : can.dispatch ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-slate-600">Payment confirmed. Pack all {order.items.reduce((a, i) => a + i.qty, 0)} book(s) and record dispatch.</p>
                      <Button onClick={() => setModal("dispatch")}><PackageCheck /> Record dispatch</Button>
                    </div>
                  ) : <NoPerm text="Requires “Manage dispatch”" />
              )}
              {order.shipment && (
                <div className="space-y-3">
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div><dt className="text-xs text-slate-500">{order.shipment.mode === "self" ? "Dispatched by" : "Courier"}</dt><dd className="font-semibold text-fg">{order.shipment.courier}</dd></div>
                    <div><dt className="text-xs text-slate-500">Tracking</dt><dd className="font-mono font-semibold text-fg">{order.shipment.tracking}</dd></div>
                    <div><dt className="text-xs text-slate-500">{order.shipment.deliveredAt ? "Delivered" : "Dispatched"}</dt><dd className="font-semibold text-fg">{formatDateTime(order.shipment.deliveredAt ?? order.shipment.dispatchedAt)}</dd></div>
                  </dl>
                  {order.shipment.notes && <p className="text-xs text-slate-500">Notes: {order.shipment.notes}</p>}
                  {order.status === "shipped" && can.dispatch && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setModal("update")}>Add tracking update</Button>
                      <Button size="sm" onClick={() => { markDelivered(order.id, admin.id); toast({ title: "Marked delivered", simulated: true }); }}><CircleCheck /> Mark delivered</Button>
                    </div>
                  )}
                </div>
              )}
              {!order.shipment && order.status !== "processing" && <p className="text-slate-500">{["cancelled", "refunded"].includes(order.status) ? "Not shipped." : "Dispatch becomes available after payment is confirmed."}</p>}
            </div>
          </Card>

          {/* Refunds */}
          {(order.refunds.length > 0 || (order.status === "cancelled" && isPaid(order))) && (
            <Card>
              <CardHeader title="Refunds" action={can.refunds && isPaid(order) && <Button size="sm" variant="secondary" onClick={() => { setRefundContext(order.returnRequest ? "return" : "cancellation"); setModal("refund"); }}><Plus /> Record refund</Button>} />
              {order.refunds.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No refund recorded yet for this cancelled, paid order.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {order.refunds.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-fg">{formatINR(r.amount)} · {r.method === "upi" ? "UPI" : "Bank"} {r.reference && <span className="font-mono text-slate-500">· {r.reference}</span>}</p>
                        <p className="text-xs text-slate-500">{r.context} · recorded by {r.recordedBy}, {formatDateTime(r.recordedAt)}{r.completedAt && ` · completed ${formatDateTime(r.completedAt)}`}</p>
                      </div>
                      <Badge tone={r.status === "completed" ? "green" : "amber"} size="xs" dot>{r.status}</Badge>
                      {r.status === "pending" && can.refunds && <Button size="xs" onClick={() => setCompleting(r)}>Mark completed</Button>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card>
            <CardHeader title="Items" description="Prices are the snapshot taken when the order was placed." />
            <div className="px-5"><OrderItemsList order={order} /></div>
            <div className="border-t border-line p-5"><TotalsBlock subtotal={order.subtotal} shipping={order.shipping} total={order.total} /></div>
          </Card>

          <Card>
            <CardHeader title="Timeline & audit history" description="Internal notes are hidden from the customer." />
            <div className="p-5"><OrderTimeline events={order.events} audit /></div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center gap-3">
                <Avatar name={customer?.name ?? "?"} />
                <div className="min-w-0">
                  <p className="font-semibold text-fg">{customer?.name}</p>
                  <p className="truncate text-xs text-slate-500">{customer?.email}</p>
                </div>
              </div>
              {customer && hasAnyBookPermission(admin) && <Link href={`/admin/learners/${customer.id}`} className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline">Learner record →</Link>}
              <p className="text-xs text-slate-500">{state.bookOrders.filter((o) => o.learnerId === order.learnerId).length} bookstore order(s)</p>
            </div>
          </Card>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><MapPin className="size-4 text-brand-600 dark:text-brand-400" /> Delivery address</span>} />
            <div className="p-5"><AddressBlock address={order.address} /></div>
          </Card>
        </aside>
      </div>

      {/* Dialogs */}
      {modal === "approve" && pay && <ApproveDialog order={order} onClose={close} onConfirm={() => { approveBookPayment(order.id, pay.id, admin.id); toast({ title: "Payment approved", description: "Order moved to Processing.", simulated: true }); close(); }} />}
      {modal === "reject" && pay && (
        <ReasonDialog
          title="Reject payment"
          description="The customer sees this reason and can resubmit against the same order."
          confirmLabel="Reject payment"
          danger
          quick={["Reference not found in our account statement. Please check the transaction ID and resubmit.", "Amount received doesn't match the order total.", "Payment received from an account we couldn't match — please share the payer name."]}
          onClose={close}
          onConfirm={(r) => { rejectBookPayment(order.id, pay.id, r, admin.id); toast({ title: "Payment rejected", simulated: true }); close(); }}
        />
      )}
      {modal === "hold" && <ReasonDialog title="Put order on hold" description="Use when any item can't be fulfilled. The whole order is held — partial shipment isn't supported. The customer is notified." confirmLabel="Put on hold" quick={["One book is temporarily out of stock. The whole order ships together once restocked.", "Delivery address needs confirmation — we'll contact you."]} onClose={close} onConfirm={(r) => { setOrderHold(order.id, r, admin.id); toast({ title: "Order on hold", simulated: true }); close(); }} />}
      {modal === "cancelUnpaid" && <ReasonDialog title="Cancel unpaid order" description="No payment has been confirmed, so no refund is needed. Reserved stock is released." confirmLabel="Cancel order" danger quick={["Payment not received within the reservation window.", "Cancelled at the customer's request by phone."]} onClose={close} onConfirm={(r) => { adminCancelUnpaidOrder(order.id, r, admin.id); toast({ title: "Order cancelled", simulated: true }); close(); }} />}
      {modal === "update" && <ReasonDialog title="Add tracking update" description="Shown on the customer's order timeline." confirmLabel="Add update" quick={["In transit: reached the destination hub.", "Out for delivery today."]} onClose={close} onConfirm={(r) => { addTrackingUpdate(order.id, r, admin.id); close(); }} />}
      {modal === "note" && <NoteDialog onClose={close} onConfirm={(note, notify) => { addOrderNote(order.id, note, admin.id, notify); toast({ title: notify ? "Customer notified" : "Note added", simulated: notify }); close(); }} />}
      {modal === "dispatch" && <DispatchDialog order={order} onClose={close} />}
      {modal === "decideCancel" && <CancellationDialog order={order} onClose={close} />}
      {modal === "reviewReturn" && <ReturnReviewDialog order={order} onClose={close} />}
      {modal === "replacement" && <ReplacementDialog order={order} onClose={close} />}
      {modal === "refund" && <RefundDialog order={order} context={refundContext} onClose={close} />}
      {modal === "extraPayment" && <ExtraPaymentDialog order={order} onClose={close} />}
      {modal === "edit" && <EditOrderDialog order={order} onClose={close} />}
      {completing && <CompleteRefundDialog orderId={order.id} refund={completing} onClose={() => setCompleting(null)} />}
    </div>
  );
}

/* --------------------------------- Dialogs --------------------------------- */

function ApproveDialog({ order, onClose, onConfirm }: { order: BookOrder; onClose: () => void; onConfirm: () => void }) {
  const [checked, setChecked] = useState(false);
  const pay = latestPayment(order)!;
  return (
    <ConfirmDialog open onClose={onClose} onConfirm={onConfirm} confirmDisabled={!checked} title={`Approve ${formatINR(pay.amount)} for ${order.number}?`} description="The order moves to Processing, stock is deducted and the customer is notified." confirmLabel="Approve payment">
      <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} label={`I verified ${formatINR(pay.amount)} with reference ${pay.reference} in our ${pay.method === "upi" ? "UPI" : "bank"} account statement.`} description="A screenshot alone is not proof of payment." />
      <SimulatedNote className="mt-3">Prototype: no account is actually checked.</SimulatedNote>
    </ConfirmDialog>
  );
}

export function ReasonDialog({ title, description, confirmLabel, quick = [], danger, onClose, onConfirm }: { title: string; description: string; confirmLabel: string; quick?: string[]; danger?: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      tone={danger ? "danger" : "default"}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      onConfirm={() => {
        if (reason.trim().length < 5) return setError("Please enter a reason (at least 5 characters).");
        onConfirm(reason.trim());
      }}
    >
      {quick.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => { setReason(q); setError(null); }} className="rounded-full border border-line-strong bg-surface px-2.5 py-1 text-left text-xs text-slate-600 hover:border-brand-300">
              {q.length > 48 ? `${q.slice(0, 46)}…` : q}
            </button>
          ))}
        </div>
      )}
      <Field label="Reason" error={error} required>
        {(p) => <Textarea {...p} rows={3} value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} />}
      </Field>
    </ConfirmDialog>
  );
}

function NoteDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (note: string, notify: boolean) => void }) {
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog open onClose={onClose} title="Add note" description="Use for follow-ups such as chasing a pending verification." confirmLabel={notify ? "Add & notify customer" : "Add internal note"} onConfirm={() => { if (note.trim().length < 3) return setError("Enter a note"); onConfirm(note.trim(), notify); }}>
      <Field label="Note" error={error} required>{(p) => <Textarea {...p} rows={3} value={note} onChange={(e) => { setNote(e.target.value); setError(null); }} />}</Field>
      <Checkbox className="mt-3" checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Show on the customer's timeline and notify them" description="In-app notification; email is simulated." />
    </ConfirmDialog>
  );
}

function DispatchDialog({ order, onClose }: { order: BookOrder; onClose: () => void }) {
  const { admin } = useSession();
  const [mode, setMode] = useState<"courier" | "self">("courier");
  const [courier, setCourier] = useState(COURIERS[0]);
  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!admin) return null;
  return (
    <Modal open onClose={onClose} title={`Record dispatch · ${order.number}`} description="Enter courier and tracking details manually. No courier API is connected." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { if (tracking.trim().length < 4) return setError("Enter a tracking number or dispatch reference"); dispatchOrder(order.id, { mode, courier: mode === "self" ? "StudyVerse dispatch" : courier, tracking: tracking.trim(), notes: notes.trim() || undefined }, admin.id); toast({ title: `${order.number} shipped`, description: "Customer notified.", simulated: true }); onClose(); }}><Truck /> Mark as shipped</Button></>}>
      <div className="space-y-4">
        <Segmented label="Dispatch method" className="w-full" value={mode} onChange={setMode} options={[{ value: "courier", label: "External courier" }, { value: "self", label: "StudyVerse dispatch" }]} />
        {mode === "courier" && <Field label="Courier company">{(p) => <Select {...p} value={courier} onChange={(e) => setCourier(e.target.value)}>{COURIERS.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>}
        <Field label={mode === "self" ? "Dispatch reference" : "Tracking number"} error={error} required>{(p) => <Input {...p} className="font-mono" value={tracking} onChange={(e) => { setTracking(e.target.value); setError(null); }} />}</Field>
        <Field label="Dispatch notes (internal)">{(p) => <Input {...p} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 2 books, 1.2 kg" />}</Field>
        <div className="rounded-xl bg-slate-50 p-3"><p className="mb-1 text-xs font-semibold text-slate-500">Shipping to</p><AddressBlock address={order.address} /></div>
      </div>
    </Modal>
  );
}

type RefundDraft = { amount: string; method: PaymentMethod; reference: string; status: "pending" | "completed" };

function RefundFields({ v, set, max }: { v: RefundDraft; set: (v: RefundDraft) => void; max: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Refund amount (₹)" hint={`Up to ${formatINR(max)}`}>{(p) => <Input {...p} inputMode="numeric" value={v.amount} onChange={(e) => set({ ...v, amount: e.target.value.replace(/\D/g, "") })} />}</Field>
      <Field label="Method">{(p) => <Select {...p} value={v.method} onChange={(e) => set({ ...v, method: e.target.value as PaymentMethod })}><option value="upi">UPI</option><option value="bank">Bank transfer</option></Select>}</Field>
      <Field label="Refund reference">{(p) => <Input {...p} className="font-mono" value={v.reference} onChange={(e) => set({ ...v, reference: e.target.value })} placeholder="UTR / NEFT reference" />}</Field>
      <Field label="Status">{(p) => <Select {...p} value={v.status} onChange={(e) => set({ ...v, status: e.target.value as RefundDraft["status"] })}><option value="completed">Completed (money sent)</option><option value="pending">Pending (to be sent)</option></Select>}</Field>
    </div>
  );
}

function validRefund(v: RefundDraft, max: number): string | null {
  const n = Number(v.amount);
  if (!n || n <= 0) return "Enter the refund amount";
  if (n > max) return `Refund can't exceed ${formatINR(max)}`;
  if (v.status === "completed" && v.reference.trim().length < 4) return "Enter the refund transaction reference";
  return null;
}

function CancellationDialog({ order, onClose }: { order: BookOrder; onClose: () => void }) {
  const { admin } = useSession();
  const paid = amountPaid(order);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [note, setNote] = useState("");
  const [withRefund, setWithRefund] = useState(paid > 0);
  const [refund, setRefund] = useState<RefundDraft>({ amount: String(paid), method: latestPayment(order)?.method ?? "upi", reference: "", status: "completed" });
  const [error, setError] = useState<string | null>(null);
  if (!admin) return null;
  return (
    <Modal open onClose={onClose} title={`Cancellation request · ${order.number}`} description={order.cancellation?.reason} footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button variant={decision === "approve" ? "primary" : "danger"} onClick={() => {
      if (decision === "reject" && note.trim().length < 5) return setError("Explain why the request is declined");
      if (decision === "approve" && withRefund) { const e = validRefund(refund, paid); if (e) return setError(e); }
      decideCancellation(order.id, decision === "approve", note.trim(), admin.id, decision === "approve" && withRefund ? { amount: Number(refund.amount), method: refund.method, reference: refund.reference.trim(), status: refund.status } : undefined);
      toast({ title: decision === "approve" ? "Cancellation approved" : "Cancellation declined", simulated: true });
      onClose();
    }}>{decision === "approve" ? "Approve cancellation" : "Decline request"}</Button></>}>
      <div className="space-y-4">
        <Segmented label="Decision" className="w-full" value={decision} onChange={(d) => { setDecision(d); setError(null); }} options={[{ value: "approve", label: "Approve" }, { value: "reject", label: "Decline" }]} />
        <Field label={decision === "approve" ? "Note to customer (optional)" : "Reason (shown to customer)"} required={decision === "reject"}>{(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => { setNote(e.target.value); setError(null); }} />}</Field>
        {decision === "approve" && order.status === "processing" && <p className="text-xs text-slate-500">Stock deducted at payment confirmation will be returned to inventory.</p>}
        {decision === "approve" && paid > 0 && (
          <div className="rounded-xl border border-line p-4">
            <Checkbox checked={withRefund} onChange={(e) => setWithRefund(e.target.checked)} label={`Record manual refund of the ${formatINR(paid)} paid`} description="Refunds are sent outside StudyVerse by UPI or bank transfer." />
            {withRefund && <div className="mt-4"><RefundFields v={refund} set={setRefund} max={paid} /></div>}
          </div>
        )}
        {decision === "approve" && paid === 0 && order.status === "payment_verification" && <Callout tone="info">A payment submission is still unverified. If money has arrived, record a refund afterwards from the Refunds card.</Callout>}
        {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </Modal>
  );
}

function ReturnReviewDialog({ order, onClose }: { order: BookOrder; onClose: () => void }) {
  const { admin } = useSession();
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!admin || !order.returnRequest) return null;
  const rr = order.returnRequest;
  return (
    <Modal open onClose={onClose} title={`Return request · ${order.number}`} description={`${RETURN_REASON_LABEL[rr.reason]} · ${rr.preference} preferred`} footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button variant={decision === "approve" ? "primary" : "danger"} onClick={() => { if (note.trim().length < 5) return setError("Add a note for the customer"); reviewReturn(order.id, decision === "approve", note.trim(), admin.id); toast({ title: decision === "approve" ? "Return approved" : "Return rejected", simulated: true }); onClose(); }}>{decision === "approve" ? "Approve return" : "Reject return"}</Button></>}>
      <div className="space-y-4">
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{rr.details}</p>
        {rr.photos.length > 0 && <div className="flex flex-wrap gap-2">{rr.photos.map((p) => <span key={p} className="grid aspect-square w-24 place-items-center rounded-lg border border-dashed border-line-strong bg-slate-50 p-2 text-center text-[11px] text-slate-500"><Camera className="size-5" />{p}</span>)}</div>}
        <Segmented label="Decision" className="w-full" value={decision} onChange={setDecision} options={[{ value: "approve", label: "Approve" }, { value: "reject", label: "Reject" }]} />
        <Field label="Note to customer" error={error} required>{(p) => <Textarea {...p} rows={3} value={note} onChange={(e) => { setNote(e.target.value); setError(null); }} placeholder={decision === "approve" ? `e.g. Damage confirmed from photos. Sending a ${rr.preference === "refund" ? "refund" : "replacement copy"}.` : "e.g. The photos don't show damage covered by our policy."} />}</Field>
        <p className="text-xs text-slate-500">Return shipping and pickup rules are an open policy decision — handle them manually for now.</p>
      </div>
    </Modal>
  );
}

function ReplacementDialog({ order, onClose }: { order: BookOrder; onClose: () => void }) {
  const { state, admin, now } = useSession();
  const [courier, setCourier] = useState(COURIERS[0]);
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!admin) return null;
  const short = order.items.filter((i) => (state.books.find((b) => b.id === i.bookId)?.stock ?? 0) < i.qty);
  return (
    <Modal open onClose={onClose} title={`Send replacement · ${order.number}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={short.length > 0} onClick={() => { if (tracking.trim().length < 4) return setError("Enter the tracking number"); sendReplacement(order.id, { courier, tracking: tracking.trim() }, admin.id); toast({ title: "Replacement shipped", description: "Inventory history updated.", simulated: true }); onClose(); }}>Ship replacement</Button></>}>
      <div className="space-y-4">
        <ul className="space-y-1 text-sm">{order.items.map((i) => { const b = state.books.find((x) => x.id === i.bookId); return <li key={i.bookId} className="flex justify-between"><span>{i.title} × {i.qty}</span><span className="text-slate-500">{b ? `${b.stock} on hand · ${availableStock(b, state.bookOrders, now)} available` : "—"}</span></li>; })}</ul>
        {short.length > 0 && <Callout tone="danger">Not enough stock on hand for a replacement. Add stock first.</Callout>}
        <Field label="Courier">{(p) => <Select {...p} value={courier} onChange={(e) => setCourier(e.target.value)}>{COURIERS.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
        <Field label="Tracking number" error={error} required>{(p) => <Input {...p} className="font-mono" value={tracking} onChange={(e) => { setTracking(e.target.value); setError(null); }} />}</Field>
        <p className="text-xs text-slate-500">Replacement copies are deducted from stock and logged in inventory history.</p>
      </div>
    </Modal>
  );
}

function RefundDialog({ order, context, onClose }: { order: BookOrder; context: Refund["context"]; onClose: () => void }) {
  const { admin } = useSession();
  const paid = amountPaid(order);
  const refunded = order.refunds.reduce((a, r) => a + r.amount, 0);
  const max = context === "adjustment" ? -(order.paymentDifference ?? 0) : Math.max(0, paid - refunded);
  const [v, setV] = useState<RefundDraft>({ amount: String(max), method: latestPayment(order)?.method ?? "upi", reference: "", status: "completed" });
  const [error, setError] = useState<string | null>(null);
  if (!admin) return null;
  return (
    <Modal open onClose={onClose} title={`Record refund · ${order.number}`} description={`Paid ${formatINR(paid)} · already refunded ${formatINR(refunded)}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { const e = validRefund(v, max); if (e) return setError(e); recordRefund(order.id, { amount: Number(v.amount), method: v.method, reference: v.reference.trim(), status: v.status }, context, admin.id); toast({ title: "Refund recorded", simulated: true }); onClose(); }}>Record refund</Button></>}>
      <div className="space-y-4">
        <RefundFields v={v} set={(x) => { setV(x); setError(null); }} max={max} />
        {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
        <SimulatedNote>Refunds are sent outside StudyVerse. This only records the details.</SimulatedNote>
      </div>
    </Modal>
  );
}

function CompleteRefundDialog({ orderId, refund, onClose }: { orderId: string; refund: Refund; onClose: () => void }) {
  const { admin } = useSession();
  const [ref, setRef] = useState(refund.reference);
  const [error, setError] = useState<string | null>(null);
  if (!admin) return null;
  return (
    <ConfirmDialog open onClose={onClose} title={`Mark ${formatINR(refund.amount)} refund completed?`} confirmLabel="Mark completed" onConfirm={() => { if (ref.trim().length < 4) return setError("Enter the refund reference"); completeRefund(orderId, refund.id, ref.trim(), admin.id); toast({ title: "Refund completed", simulated: true }); onClose(); }}>
      <Field label="Refund reference" error={error} required>{(p) => <Input {...p} className="font-mono" value={ref} onChange={(e) => { setRef(e.target.value); setError(null); }} />}</Field>
    </ConfirmDialog>
  );
}

function ExtraPaymentDialog({ order, onClose }: { order: BookOrder; onClose: () => void }) {
  const { admin } = useSession();
  const due = order.paymentDifference ?? 0;
  const [v, setV] = useState({ amount: String(due), method: "upi" as PaymentMethod, reference: "" });
  const [error, setError] = useState<string | null>(null);
  if (!admin) return null;
  return (
    <ConfirmDialog open onClose={onClose} title={`Record additional payment · ${formatINR(due)} due`} description="Only after verifying the transfer in the account." confirmLabel="Record payment" onConfirm={() => {
      const n = Number(v.amount);
      if (!n || n <= 0 || n > due) return setError(`Enter an amount up to ${formatINR(due)}`);
      if (v.reference.trim().length < 6) return setError("Enter the transaction reference");
      settleAdditionalPayment(order.id, { amount: n, method: v.method, reference: v.reference.trim() }, admin.id);
      toast({ title: "Additional payment recorded", simulated: true });
      onClose();
    }}>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Amount (₹)">{(p) => <Input {...p} inputMode="numeric" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value.replace(/\D/g, "") })} />}</Field>
        <Field label="Method">{(p) => <Select {...p} value={v.method} onChange={(e) => setV({ ...v, method: e.target.value as PaymentMethod })}><option value="upi">UPI</option><option value="bank">Bank transfer</option></Select>}</Field>
        <Field label="Transaction reference" error={error}>{(p) => <Input {...p} className="font-mono" value={v.reference} onChange={(e) => { setV({ ...v, reference: e.target.value }); setError(null); }} />}</Field>
      </div>
    </ConfirmDialog>
  );
}

function EditOrderDialog({ order, onClose }: { order: BookOrder; onClose: () => void }) {
  const { state, admin } = useSession();
  const [items, setItems] = useState(order.items.map((i) => ({ bookId: i.bookId, qty: i.qty })));
  const [address, setAddress] = useState<AddressSnapshot>(order.address);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!admin) return null;
  const paid = isPaid(order);
  const priced = items.filter((i) => i.qty > 0).map((i) => {
    const snap = order.items.find((x) => x.bookId === i.bookId);
    const b = state.books.find((x) => x.id === i.bookId);
    return { ...i, title: snap?.title ?? b?.title ?? "", theme: snap?.theme ?? b?.theme ?? "teal", unitPrice: snap?.unitPrice ?? b?.price ?? 0, mrp: snap?.mrp ?? b?.mrp ?? 0, isNew: !snap };
  });
  const t = totalsFor(priced, state.bookstore);
  const diff = paid ? t.total - amountPaid(order) : t.total - order.total;
  const addable = state.books.filter((b) => b.status === "published" && !items.some((i) => i.bookId === b.id));
  const setA = (k: keyof AddressSnapshot, v: string) => setAddress((a) => ({ ...a, [k]: v }));

  return (
    <Modal open onClose={onClose} size="xl" title={`Edit order ${order.number}`} description="Limited pre-dispatch edits. Totals are recalculated and every change is recorded." footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { const r = editOrder(order.id, { items, address }, admin.id); if (!r.ok) return setError(r.error); toast({ title: "Order updated", description: "Customer notified.", simulated: true }); onClose(); }}>Save changes</Button></>}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold text-fg">Items</p>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {priced.map((i) => (
              <li key={i.bookId} className="flex items-center gap-3 p-3">
                <SnapshotCover title={i.title} theme={i.theme} className="w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{i.title}</p>
                  <p className="text-xs text-slate-500">{formatINR(i.unitPrice)} each{i.isNew && " · current price"}</p>
                </div>
                <div className="flex items-center rounded-lg border border-line-strong">
                  <button type="button" className="grid size-8 place-items-center" aria-label="Decrease" onClick={() => setItems((xs) => xs.map((x) => (x.bookId === i.bookId ? { ...x, qty: Math.max(0, x.qty - 1) } : x)))}><Minus className="size-3.5" /></button>
                  <span className="w-7 text-center text-sm font-bold">{i.qty}</span>
                  <button type="button" className="grid size-8 place-items-center" aria-label="Increase" onClick={() => setItems((xs) => xs.map((x) => (x.bookId === i.bookId ? { ...x, qty: x.qty + 1 } : x)))}><Plus className="size-3.5" /></button>
                </div>
                <button type="button" className="rounded p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400" aria-label={`Remove ${i.title}`} onClick={() => setItems((xs) => xs.filter((x) => x.bookId !== i.bookId))}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Add a book">
              <option value="">Add a book…</option>
              {addable.map((b) => <option key={b.id} value={b.id}>{b.title} · {formatINR(b.price)}</option>)}
            </Select>
            <Button variant="secondary" disabled={!adding} onClick={() => { setItems((xs) => [...xs, { bookId: adding, qty: 1 }]); setAdding(""); }}>Add</Button>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <TotalsBlock subtotal={t.subtotal} shipping={t.shipping} total={t.total} />
            {diff !== 0 && (
              <p className={cn("mt-3 rounded-lg px-3 py-2 text-xs font-semibold", paid ? "bg-amber-100 dark:bg-amber-500/15 text-amber-900 dark:text-amber-100" : "bg-sky-50 dark:bg-sky-500/10 text-sky-900 dark:text-sky-100")}>
                {paid
                  ? diff > 0 ? `Customer has paid ${formatINR(amountPaid(order))}. ${formatINR(diff)} extra will be flagged as due.` : `${formatINR(-diff)} will be flagged for refund.`
                  : order.status === "payment_verification" ? `Total changes by ${formatINR(diff)} — the submitted payment won't match. Consider rejecting and asking for a resubmission.` : `New amount payable: ${formatINR(t.total)}.`}
              </p>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-fg">Delivery address</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name">{(p) => <Input {...p} value={address.fullName} onChange={(e) => setA("fullName", e.target.value)} />}</Field>
            <Field label="Mobile">{(p) => <Input {...p} value={address.mobile} onChange={(e) => setA("mobile", e.target.value)} />}</Field>
            <Field label="House / street" className="sm:col-span-2">{(p) => <Input {...p} value={address.line1} onChange={(e) => setA("line1", e.target.value)} />}</Field>
            <Field label="Locality">{(p) => <Input {...p} value={address.locality} onChange={(e) => setA("locality", e.target.value)} />}</Field>
            <Field label="City">{(p) => <Input {...p} value={address.city} onChange={(e) => setA("city", e.target.value)} />}</Field>
            <Field label="State">{(p) => <Select {...p} value={address.state} onChange={(e) => setA("state", e.target.value)}>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</Select>}</Field>
            <Field label="PIN">{(p) => <Input {...p} value={address.pin} maxLength={6} onChange={(e) => setA("pin", e.target.value.replace(/\D/g, ""))} />}</Field>
          </div>
        </div>
      </div>
      {error && <p className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
    </Modal>
  );
}

