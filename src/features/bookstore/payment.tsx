"use client";

import { useRef, useState, type FormEvent } from "react";
import { Building2, CircleCheck, Clock, FileImage, Hourglass, Package, Paperclip, Smartphone, Trash2, TriangleAlert } from "lucide-react";
import { OrderItemsList, TotalsBlock } from "@/components/bookstore/order-ui";
import { Breadcrumbs } from "@/components/page-banner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardHeader, EmptyState, SimulatedNote, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Segmented } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { latestPayment, reservationState } from "@/lib/bookstore";
import { submitBookPayment } from "@/lib/bookstore-store";
import { useSession } from "@/lib/hooks";
import { useNow } from "@/lib/store";
import type { PaymentMethod } from "@/lib/types";
import { cn, formatDateTime, formatINR } from "@/lib/utils";
import { CopyRow, DemoQr } from "../subscribe/subscribe-view";

function timeLeft(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export function OrderPayment({ orderId }: { orderId: string }) {
  const { state, ready, learner } = useSession();
  const now = useNow(30_000);
  const order = state.bookOrders.find((o) => o.id === orderId);
  const [tab, setTab] = useState<PaymentMethod>("upi");
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ reference?: string; amount?: string; file?: string; form?: string }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready) return <div className="container-page py-10"><Skeleton className="h-96 w-full rounded-2xl" /></div>;
  if (!order || !learner || order.learnerId !== learner.id) {
    return (
      <div className="container-page py-20">
        <EmptyState icon={<Package />} title="Order not found" description={learner ? "This order isn't in your account." : "Log in to view your order."} action={<ButtonLink href={learner ? "/dashboard/orders" : `/login?next=/books/orders/${orderId}/payment`}>{learner ? "My orders" : "Log in"}</ButtonLink>} />
      </div>
    );
  }

  const s = state.bookstore;
  const res = reservationState(order, now);
  const last = latestPayment(order);
  const canSubmit = order.status === "pending_payment" || order.status === "payment_rejected";
  const amountValue = amount === "" ? order.total : Number(amount);

  const validate = () => {
    const errs: typeof errors = {};
    const ref = reference.trim();
    if (!ref) errs.reference = "Enter the transaction reference";
    else if (method === "upi" && !/^\d{12}$/.test(ref)) errs.reference = "UPI transaction IDs (UTR) are 12 digits";
    else if (method === "bank" && !/^[A-Za-z0-9-]{6,22}$/.test(ref)) errs.reference = "Enter a valid NEFT/IMPS reference (6–22 letters or digits)";
    if (!Number.isFinite(amountValue) || amountValue <= 0) errs.amount = "Confirm the amount you paid";
    if (file && file.size > 5 * 1024 * 1024) errs.file = "Screenshot must be smaller than 5 MB";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const confirm = () => {
    const r = submitBookPayment(order.id, { method, reference: reference.trim(), amount: amountValue, screenshotName: file?.name });
    setConfirmOpen(false);
    if (!r.ok) {
      setErrors({ form: r.error });
      return;
    }
    setReference("");
    setFile(null);
    toast({ title: "Payment details submitted", description: "Status: Payment Verification.", simulated: true });
  };

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ href: "/dashboard/orders", label: "My orders" }, { href: `/dashboard/orders/${order.id}`, label: order.number }, { label: "Payment" }]} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{canSubmit ? (order.status === "payment_rejected" ? "Resubmit your payment" : "Complete your payment") : "Payment submitted"}</h1>
          <p className="mt-1 text-slate-500">
            Order {order.number} · placed {formatDateTime(order.createdAt)}
          </p>
        </div>
        <ButtonLink href={`/dashboard/orders/${order.id}`} variant="secondary">
          View order details
        </ButtonLink>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {/* Status banners */}
          {order.status === "payment_verification" && last && (
            <Card className="p-6 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Hourglass className="size-7" />
              </span>
              <h2 className="mt-4 text-xl font-extrabold">Thanks — we&apos;re verifying your payment</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Our team checks the transfer directly in our {last.method === "upi" ? "UPI" : "bank"} account before confirming. Your books stay reserved until then — the order won&apos;t be cancelled because of a verification delay.
              </p>
              <dl className="mx-auto mt-5 max-w-sm space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm">
                <Row k="Status" v="Payment Verification" />
                <Row k="Reference" v={<span className="font-mono">{last.reference}</span>} />
                <Row k="Amount" v={formatINR(last.amount)} />
                <Row k="Submitted" v={formatDateTime(last.submittedAt)} />
              </dl>
              <SimulatedNote className="mt-5 justify-center">Prototype: approve or reject this payment from Admin → Bookstore → Orders.</SimulatedNote>
            </Card>
          )}
          {!canSubmit && order.status !== "payment_verification" && (
            <Callout tone="success" icon={<CircleCheck />} title="This order's payment has already been handled" action={<ButtonLink href={`/dashboard/orders/${order.id}`} size="sm">Track order</ButtonLink>}>
              Current status: {order.status.replace(/_/g, " ")}.
            </Callout>
          )}
          {order.status === "payment_rejected" && last?.rejectionReason && (
            <Callout tone="danger" icon={<TriangleAlert />} title="Your last payment submission was rejected">
              {last.rejectionReason}
              <span className="mt-1 block text-xs opacity-80">You can correct the details below and resubmit against this same order.</span>
            </Callout>
          )}
          {canSubmit && res === "active" && (
            <Callout tone="info" icon={<Clock />} title={`Books reserved for ${timeLeft(order.reservationExpiresAt - now)}`}>
              Submit your payment details before {formatDateTime(order.reservationExpiresAt)}. Reservation starts when the order is placed (working assumption — policy to be confirmed).
            </Callout>
          )}
          {canSubmit && res === "expired" && (
            <Callout tone="warning" icon={<TriangleAlert />} title="Your reservation has expired">
              The {s.reservationHours}-hour window ended on {formatDateTime(order.reservationExpiresAt)} and the books were released. You can still submit payment if they&apos;re in stock — we&apos;ll check availability when you submit.
            </Callout>
          )}

          {canSubmit && (
            <>
              <Card>
                <CardHeader title="1. Pay outside StudyVerse" description="Transfer the exact amount using UPI or bank transfer." />
                <div className="p-5">
                  <div className="flex items-center justify-between rounded-xl bg-brand-50 dark:bg-brand-400/10 px-4 py-3">
                    <span className="text-sm font-semibold text-brand-900 dark:text-brand-100">Amount to pay</span>
                    <span className="text-2xl font-extrabold text-brand-800 dark:text-brand-200">{formatINR(order.total)}</span>
                  </div>
                  <Segmented
                    label="Payment option"
                    className="mt-4 w-full"
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: "upi", label: <span className="inline-flex items-center gap-1.5"><Smartphone className="size-4" /> UPI</span> },
                      { value: "bank", label: <span className="inline-flex items-center gap-1.5"><Building2 className="size-4" /> Bank transfer</span> },
                    ]}
                  />
                  {tab === "upi" ? (
                    <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                      <DemoQr />
                      <div className="w-full flex-1 space-y-3">
                        <CopyRow label="UPI ID" value={s.upiId} />
                        <CopyRow label="Payee name" value={s.payeeName} />
                        <CopyRow label="Add this note" value={order.number} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <CopyRow label="Bank" value={s.bankName} />
                      <CopyRow label="Account name" value={s.accountName} />
                      <CopyRow label="Account number" value={s.accountNumber} />
                      <CopyRow label="IFSC" value={s.ifsc} />
                    </div>
                  )}
                  <SimulatedNote className="mt-4">Demo payment details — don&apos;t send real money. No payment is processed or verified in the prototype.</SimulatedNote>
                </div>
              </Card>

              <Card>
                <CardHeader title="2. Submit your payment details" />
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    if (validate()) setConfirmOpen(true);
                  }}
                  noValidate
                  className="space-y-5 p-5"
                >
                  {errors.form && <Callout tone="danger">{errors.form}</Callout>}
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-fg">How did you pay?</legend>
                    <Segmented label="Payment method used" className="w-full" value={method} onChange={(m) => { setMethod(m); setErrors((x) => ({ ...x, reference: undefined })); }} options={[{ value: "upi", label: "UPI" }, { value: "bank", label: "Bank transfer" }]} />
                  </fieldset>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={method === "upi" ? "UPI transaction ID (UTR)" : "Bank reference number"} error={errors.reference} required hint={method === "upi" ? "12 digits, shown in your UPI app's payment details." : "NEFT/IMPS reference from your bank."}>
                      {(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} className="font-mono" placeholder={method === "upi" ? "e.g. 418822001934" : "e.g. NEFT-N310924588"} />}
                    </Field>
                    <Field label="Amount paid (₹)" error={errors.amount} required hint={amountValue !== order.total ? `Order total is ${formatINR(order.total)}` : "Confirm the exact amount you transferred."}>
                      {(p) => <Input {...p} inputMode="numeric" value={amount === "" ? String(order.total) : amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />}
                    </Field>
                  </div>
                  {amountValue !== order.total && Number.isFinite(amountValue) && amountValue > 0 && (
                    <p className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100 ring-1 ring-amber-200 dark:ring-amber-500/30">
                      <TriangleAlert className="mt-px size-3.5 shrink-0" /> The amount differs from the order total. Mismatched payments may be rejected.
                    </p>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-fg">
                      Payment screenshot <span className="font-normal text-slate-400">(optional)</span>
                    </p>
                    <p className="text-xs text-slate-500">Supporting information only — it isn&apos;t proof of payment. We always verify the transfer in our account.</p>
                    <input ref={fileRef} id="pay-proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    {file ? (
                      <div className={cn("mt-2 flex items-center gap-3 rounded-xl border p-3", errors.file ? "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10" : "border-line bg-slate-50")}>
                        <FileImage className="size-5 text-brand-600 dark:text-brand-400" />
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{file.name}</p>
                        <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="rounded-md p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400" aria-label="Remove screenshot">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="pay-proof" className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong px-4 py-4 text-sm font-semibold text-brand-700 dark:text-brand-300 hover:border-brand-400">
                        <Paperclip className="size-4" /> Attach screenshot
                      </label>
                    )}
                    {errors.file && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{errors.file}</p>}
                  </div>
                  <Button type="submit" block size="lg">
                    {order.status === "payment_rejected" ? "Resubmit payment details" : "Submit payment details"}
                  </Button>
                </form>
              </Card>
            </>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5 lg:sticky lg:top-24">
            <h2 className="text-base font-bold">Order {order.number}</h2>
            <OrderItemsList order={order} compact />
            <div className="mt-3 border-t border-line pt-3">
              <TotalsBlock subtotal={order.subtotal} shipping={order.shipping} total={order.total} />
            </div>
            {order.payments.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Submissions</p>
                <ul className="mt-2 space-y-2 text-xs">
                  {[...order.payments].reverse().map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-slate-600">{p.reference}</span>
                      <span className={cn("font-semibold", p.status === "approved" ? "text-emerald-600 dark:text-emerald-400" : p.status === "rejected" ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400")}>{p.status === "submitted" ? "Verifying" : p.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </aside>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm payment details"
        description="Check these match your transfer exactly."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Edit
            </Button>
            <Button onClick={confirm}>Submit</Button>
          </>
        }
      >
        <dl className="space-y-2 text-sm">
          <Row k="Order" v={order.number} />
          <Row k="Method" v={method === "upi" ? "UPI" : "Bank transfer"} />
          <Row k="Reference" v={<span className="font-mono">{reference.trim()}</span>} />
          <Row k="Amount paid" v={formatINR(amountValue)} />
          <Row k="Screenshot" v={file?.name ?? "Not attached"} />
        </dl>
        <p className="mt-4 text-xs text-slate-500">Submitting doesn&apos;t mark the order paid. It moves to Payment Verification until an admin confirms the transfer.</p>
      </Modal>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-semibold text-fg">{v}</dd>
    </div>
  );
}
