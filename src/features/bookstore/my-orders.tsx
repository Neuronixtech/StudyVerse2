"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Camera, CreditCard, MapPin, Package, Pencil, Plus, RotateCcw, Star, Trash2, Truck, X, XCircle } from "lucide-react";
import { OrderStatusBadge, SnapshotCover } from "@/components/bookstore/book-visuals";
import { AddressBlock, OrderItemsList, OrderProgress, OrderTimeline, TotalsBlock } from "@/components/bookstore/order-ui";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardHeader, EmptyState, PageHeader, SimulatedNote } from "@/components/ui/feedback";
import { Field, Segmented, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import {
  canCustomerCancelDirectly,
  canRequestCancellation,
  canRequestReturn,
  RETURN_REASON_LABEL,
  reservationState,
  returnDeadline,
} from "@/lib/bookstore";
import { cancelOrderByCustomer, deleteAddress, requestCancellation, requestReturn, saveAddress, setDefaultAddress } from "@/lib/bookstore-store";
import { useSession } from "@/lib/hooks";
import type { Address, BookOrder, ReturnReason } from "@/lib/types";
import { cn, formatDate, formatDateTime, formatINR } from "@/lib/utils";
import { AddressForm } from "./cart-checkout";

/* ------------------------------ My orders ------------------------------ */

type OrderTab = "all" | "active" | "delivered" | "closed";

export function MyOrders() {
  const { state, learner } = useSession();
  const [tab, setTab] = useState<OrderTab>("all");
  if (!learner) return null;
  const mine = state.bookOrders.filter((o) => o.learnerId === learner.id).sort((a, b) => b.createdAt - a.createdAt);
  const isActive = (o: BookOrder) => ["pending_payment", "payment_verification", "payment_rejected", "processing", "shipped"].includes(o.status);
  const isClosed = (o: BookOrder) => ["cancelled", "returned", "refunded"].includes(o.status);
  const list = mine.filter((o) => (tab === "all" ? true : tab === "active" ? isActive(o) : tab === "delivered" ? o.status === "delivered" : isClosed(o)));

  return (
    <div className="space-y-6">
      <PageHeader title="My book orders" description="Track payments, shipments, cancellations and returns." actions={<ButtonLink href="/books" variant="secondary"><Package /> Visit bookstore</ButtonLink>} />
      <Tabs
        label="Order filter"
        value={tab}
        onChange={setTab}
        items={[
          { value: "all", label: "All", count: mine.length },
          { value: "active", label: "In progress", count: mine.filter(isActive).length },
          { value: "delivered", label: "Delivered", count: mine.filter((o) => o.status === "delivered").length },
          { value: "closed", label: "Cancelled & returns", count: mine.filter(isClosed).length },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState icon={<Package />} title={mine.length ? "No orders in this view" : "You haven't ordered any books yet"} description="Physical books are delivered across India — no subscription needed." action={<ButtonLink href="/books">Browse books</ButtonLink>} />
      ) : (
        <ul className="space-y-4">
          {list.map((o) => {
            const needsPayment = o.status === "pending_payment" || o.status === "payment_rejected";
            return (
              <li key={o.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <p className="font-bold text-fg">{o.number}</p>
                    <OrderStatusBadge status={o.status} />
                    {o.hold && <Badge tone="amber" size="xs">On hold</Badge>}
                    {o.cancellation?.status === "requested" && <Badge tone="amber" size="xs">Cancellation requested</Badge>}
                    {o.returnRequest?.status === "requested" && <Badge tone="amber" size="xs">Return requested</Badge>}
                    <p className="text-xs text-slate-500 sm:ml-auto">Placed {formatDate(o.createdAt)}</p>
                  </div>
                  {/* Wraps so the actions drop below on narrow phones (no horizontal scroll at 320 px) */}
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className="flex -space-x-3">
                      {o.items.slice(0, 3).map((i) => (
                        <SnapshotCover key={i.bookId} title={i.title} theme={i.theme} className="ring-2 ring-surface" />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">{o.items.map((i) => i.title).join(", ")}</p>
                      <p className="text-xs text-slate-500">
                        {o.items.reduce((a, i) => a + i.qty, 0)} book(s) · {formatINR(o.total)}
                        {o.shipment && o.status === "shipped" && <> · {o.shipment.courier} {o.shipment.tracking}</>}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 gap-2">
                      {needsPayment && (
                        <ButtonLink href={`/books/orders/${o.id}/payment`} size="sm">
                          <CreditCard /> {o.status === "payment_rejected" ? "Resubmit" : "Pay now"}
                        </ButtonLink>
                      )}
                      <ButtonLink href={`/dashboard/orders/${o.id}`} size="sm" variant="secondary" aria-label={`View order ${o.number}`}>
                        View <ArrowRight />
                      </ButtonLink>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------- Order detail ---------------------------- */

export function OrderDetailView({ orderId }: { orderId: string }) {
  const { state, learner, now } = useSession();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  if (!learner) return null;
  const order = state.bookOrders.find((o) => o.id === orderId && o.learnerId === learner.id);
  if (!order) return <EmptyState icon={<Package />} title="Order not found" description="This order isn't in your account." action={<ButtonLink href="/dashboard/orders">My orders</ButtonLink>} />;

  const s = state.bookstore;
  const direct = canCustomerCancelDirectly(order);
  const request = canRequestCancellation(order);
  const returnable = canRequestReturn(order, s, now);
  const deadline = returnDeadline(order, s);
  const res = reservationState(order, now);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/orders" className="text-sm font-semibold text-slate-600 hover:text-fg">
        ← My orders
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold">Order {order.number}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(order.status === "pending_payment" || order.status === "payment_rejected") && (
            <ButtonLink href={`/books/orders/${order.id}/payment`}>
              <CreditCard /> {order.status === "payment_rejected" ? "Resubmit payment" : "Pay now"}
            </ButtonLink>
          )}
          {(direct || request) && (
            <Button variant="secondary" onClick={() => setCancelOpen(true)}>
              <XCircle /> {direct ? "Cancel order" : "Request cancellation"}
            </Button>
          )}
          {returnable && (
            <Button variant="secondary" onClick={() => setReturnOpen(true)}>
              <RotateCcw /> Report a problem
            </Button>
          )}
        </div>
      </div>

      <Card className="p-5">
        <OrderProgress order={order} />
      </Card>

      {/* Contextual status callouts */}
      {order.status === "pending_payment" && res === "active" && (
        <Callout tone="info" title="Waiting for your payment" action={<ButtonLink href={`/books/orders/${order.id}/payment`} size="sm">Pay {formatINR(order.total)}</ButtonLink>}>
          Books reserved until {formatDateTime(order.reservationExpiresAt)}.
        </Callout>
      )}
      {order.status === "pending_payment" && res === "expired" && (
        <Callout tone="warning" title="Reservation expired">
          You didn&apos;t submit payment within {s.reservationHours} hours, so the books were released. You can still pay if they&apos;re in stock, or cancel the order.
        </Callout>
      )}
      {order.status === "payment_verification" && <Callout tone="info" title="Payment under verification">We&apos;re checking your transfer in our account. Your books stay reserved meanwhile.</Callout>}
      {order.cancellation?.status === "requested" && <Callout tone="warning" title="Cancellation requested">Requested {formatDateTime(order.cancellation.requestedAt)}. An admin will approve or decline it before dispatch.</Callout>}
      {order.cancellation?.status === "rejected" && <Callout tone="danger" title="Cancellation declined">{order.cancellation.note}</Callout>}
      {order.status === "delivered" && deadline && !order.returnRequest && (
        <p className="text-sm text-slate-500">
          {now <= deadline ? <>Damaged, defective or incorrect book? Report it by <strong className="text-fg">{formatDate(deadline)}</strong>.</> : <>The {s.returnWindowDays}-day return window ended on {formatDate(deadline)}.</>}
        </p>
      )}
      {order.paymentDifference && (
        <Callout tone="warning" title="Your order total changed after payment">
          {order.paymentDifference > 0
            ? `An additional ${formatINR(order.paymentDifference)} is due. Our team will contact you about paying the difference.`
            : `${formatINR(-order.paymentDifference)} will be refunded to you. Our team will record the refund once sent.`}
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {order.shipment && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Truck className="size-4 text-brand-600 dark:text-brand-400" /> Shipment</span>} />
              <dl className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-500">{order.shipment.mode === "self" ? "Dispatched by" : "Courier"}</dt>
                  <dd className="font-semibold text-fg">{order.shipment.courier}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Tracking / reference</dt>
                  <dd className="font-mono font-semibold text-fg">{order.shipment.tracking}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">{order.shipment.deliveredAt ? "Delivered" : "Dispatched"}</dt>
                  <dd className="font-semibold text-fg">{formatDate(order.shipment.deliveredAt ?? order.shipment.dispatchedAt)}</dd>
                </div>
              </dl>
              <p className="border-t border-line px-5 py-3 text-xs text-slate-500">Tracking updates are entered manually by StudyVerse — no courier integration in the prototype.</p>
            </Card>
          )}

          {order.returnRequest && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><RotateCcw className="size-4 text-brand-600 dark:text-brand-400" /> Return request</span>} action={<Badge tone={order.returnRequest.status === "rejected" ? "red" : order.returnRequest.status === "resolved" ? "green" : "amber"} dot>{order.returnRequest.status[0].toUpperCase() + order.returnRequest.status.slice(1)}</Badge>} />
              <div className="space-y-2 p-5 text-sm">
                <p>
                  <strong className="text-fg">{RETURN_REASON_LABEL[order.returnRequest.reason]}</strong> · {order.returnRequest.preference} preferred · requested {formatDate(order.returnRequest.requestedAt)}
                </p>
                <p className="text-slate-600">{order.returnRequest.details}</p>
                {order.returnRequest.photos.length > 0 && <p className="flex items-center gap-1.5 text-xs text-slate-500"><Camera className="size-3.5" /> {order.returnRequest.photos.join(", ")}</p>}
                {order.returnRequest.decisionNote && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><strong>StudyVerse:</strong> {order.returnRequest.decisionNote}</p>}
                {order.returnRequest.replacement && <p className="text-xs text-slate-600">Replacement: {order.returnRequest.replacement.courier} · <span className="font-mono">{order.returnRequest.replacement.tracking}</span></p>}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Items" />
            <div className="px-5">
              <OrderItemsList order={order} />
            </div>
            <div className="border-t border-line p-5">
              <TotalsBlock subtotal={order.subtotal} shipping={order.shipping} total={order.total} savings={order.items.reduce((a, i) => a + (i.mrp - i.unitPrice) * i.qty, 0)} />
              <p className="mt-2 text-xs text-slate-500">Prices are fixed at the time of order and won&apos;t change if the catalog price changes.</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Order timeline" />
            <div className="p-5">
              <OrderTimeline events={order.events} />
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><MapPin className="size-4 text-brand-600 dark:text-brand-400" /> Delivery address</span>} />
            <div className="p-5">
              <AddressBlock address={order.address} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Payments" />
            {order.payments.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No payment submitted yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {[...order.payments].reverse().map((p) => (
                  <li key={p.id} className="space-y-1 p-4 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-fg">{formatINR(p.amount)} · {p.method === "upi" ? "UPI" : "Bank"}</span>
                      <Badge tone={p.status === "approved" ? "green" : p.status === "rejected" ? "red" : "sky"} size="xs" dot>
                        {p.status === "submitted" ? "Verifying" : p.status === "approved" ? "Confirmed" : "Rejected"}
                      </Badge>
                    </div>
                    <p className="font-mono text-xs text-slate-500">{p.reference}</p>
                    <p className="text-xs text-slate-500">Submitted {formatDateTime(p.submittedAt)}</p>
                    {p.rejectionReason && <p className="rounded-lg bg-red-50 dark:bg-red-500/10 px-2.5 py-1.5 text-xs text-red-800 dark:text-red-200">{p.rejectionReason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {order.refunds.length > 0 && (
            <Card>
              <CardHeader title="Refunds" />
              <ul className="divide-y divide-line">
                {order.refunds.map((r) => (
                  <li key={r.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-fg">{formatINR(r.amount)}</span>
                      <Badge tone={r.status === "completed" ? "green" : "amber"} size="xs" dot>{r.status === "completed" ? "Completed" : "Pending"}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {r.method === "upi" ? "UPI" : "Bank transfer"} {r.reference && <>· ref {r.reference}</>}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setReasonError(null);
        }}
        tone={direct ? "danger" : "default"}
        title={direct ? `Cancel order ${order.number}?` : "Request cancellation?"}
        description={direct ? "Your order hasn't been paid yet, so it will be cancelled immediately and the reserved books released." : "Your payment has been submitted or confirmed, so an admin will review the request before dispatch. If approved, a refund is sent manually."}
        confirmLabel={direct ? "Cancel order" : "Send request"}
        onConfirm={() => {
          if (reason.trim().length < 5) return setReasonError("Tell us briefly why (at least 5 characters).");
          if (direct) cancelOrderByCustomer(order.id, reason.trim());
          else requestCancellation(order.id, reason.trim());
          setCancelOpen(false);
          setReason("");
          toast({ title: direct ? "Order cancelled" : "Cancellation requested", simulated: true });
        }}
      >
        <Field label="Reason" error={reasonError} required>
          {(p) => <Textarea {...p} rows={3} value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(null); }} />}
        </Field>
      </ConfirmDialog>
      {returnOpen && <ReturnDialog order={order} onClose={() => setReturnOpen(false)} deadline={deadline!} />}
    </div>
  );
}

function ReturnDialog({ order, onClose, deadline }: { order: BookOrder; onClose: () => void; deadline: number }) {
  const [reason, setReason] = useState<ReturnReason>("damaged");
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [preference, setPreference] = useState<"replacement" | "refund">("replacement");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Report a damaged, defective or incorrect book"
      description={`Available until ${formatDate(deadline)}. Change-of-mind returns aren't supported.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (details.trim().length < 10) return setError("Describe the problem in a sentence or two.");
              requestReturn(order.id, { reason, details: details.trim(), photos, preference });
              toast({ title: "Return request submitted", description: "We'll review your photos and get back to you.", simulated: true });
              onClose();
            }}
          >
            Submit request
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-fg">What&apos;s wrong?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.keys(RETURN_REASON_LABEL) as ReturnReason[]).map((r) => (
              <label key={r} className={cn("cursor-pointer rounded-xl border-2 p-3 text-sm font-semibold", reason === r ? "border-brand-500 bg-brand-50 dark:bg-brand-400/10 text-fg" : "border-line text-slate-600")}>
                <input type="radio" name="return-reason" className="sr-only" checked={reason === r} onChange={() => setReason(r)} />
                {RETURN_REASON_LABEL[r]}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Details" error={error} required>
          {(p) => <Textarea {...p} rows={3} value={details} onChange={(e) => { setDetails(e.target.value); setError(null); }} placeholder="e.g. Pages 40–60 are torn" />}
        </Field>
        <div>
          <p className="text-sm font-semibold text-fg">Photos (optional, up to 4)</p>
          <input
            id="return-photos"
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => setPhotos((cur) => [...cur, ...Array.from(e.target.files ?? []).map((f) => f.name)].slice(0, 4))}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                <Camera className="size-3" /> {p}
                <button type="button" onClick={() => setPhotos((cur) => cur.filter((x) => x !== p))} aria-label={`Remove ${p}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {photos.length < 4 && (
              <label htmlFor="return-photos" className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                <Plus className="size-3" /> Add photos
              </label>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-fg">What would you like?</p>
          <Segmented label="Resolution preference" value={preference} onChange={setPreference} options={[{ value: "replacement", label: "Replacement copy" }, { value: "refund", label: "Refund" }]} />
        </div>
        <SimulatedNote>Photos stay in your browser — nothing is uploaded in the prototype.</SimulatedNote>
      </div>
    </Modal>
  );
}

/* ------------------------------ Addresses ------------------------------ */

export function AddressesPage() {
  const { state, learner } = useSession();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [removing, setRemoving] = useState<Address | null>(null);
  if (!learner) return null;
  const mine = state.addresses.filter((a) => a.learnerId === learner.id).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  return (
    <div className="space-y-6">
      <PageHeader title="Saved addresses" description="Choose one at checkout. Your default address is selected automatically." actions={<Button onClick={() => setEditing("new")}><Plus /> Add address</Button>} />
      {mine.length === 0 ? (
        <EmptyState icon={<MapPin />} title="No saved addresses" description="Add an address to speed up checkout." action={<Button onClick={() => setEditing("new")}>Add address</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {mine.map((a) => (
            <Card key={a.id} className={cn("flex flex-col p-5", a.isDefault && "border-brand-300")}>
              <div className="flex items-start justify-between gap-3">
                <AddressBlock address={a} />
                {a.isDefault && <Badge tone="brand" size="xs"><Star /> Default</Badge>}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button size="sm" variant="secondary" onClick={() => setEditing(a)}>
                  <Pencil /> Edit
                </Button>
                {!a.isDefault && (
                  <Button size="sm" variant="ghost" onClick={() => { setDefaultAddress(learner.id, a.id); toast({ title: "Default address updated" }); }}>
                    Set as default
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="ml-auto text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300" onClick={() => setRemoving(a)} aria-label={`Delete address for ${a.fullName}, ${a.city}`}>
                  <Trash2 />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add address" : "Edit address"} size="lg">
        {editing && (
          <AddressForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? { fullName: learner.name } : editing}
            onCancel={() => setEditing(null)}
            onSubmit={(a) => {
              saveAddress(learner.id, a, editing === "new" ? undefined : editing.id);
              setEditing(null);
              toast({ title: editing === "new" ? "Address added" : "Address updated" });
            }}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        tone="danger"
        title="Delete this address?"
        description="Past orders keep their own copy of the delivery address."
        confirmLabel="Delete"
        onConfirm={() => {
          if (removing) deleteAddress(learner.id, removing.id);
          setRemoving(null);
          toast({ title: "Address deleted" });
        }}
      />
    </div>
  );
}
