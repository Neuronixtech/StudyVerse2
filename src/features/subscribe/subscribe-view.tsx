"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  CircleCheck,
  Clock,
  Copy,
  Crown,
  FileImage,
  FlaskConical,
  Paperclip,
  Smartphone,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { UnlockPrompt } from "@/components/unlock-prompt";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, SimulatedNote, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Segmented, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/lib/hooks";
import { submitActivationRequest } from "@/lib/store";
import type { PaymentMethod, PlanDays } from "@/lib/types";
import { cn, DAY, formatDate, formatDateTime, formatINR } from "@/lib/utils";

function copy(text: string, label: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast({ title: `${label} copied`, tone: "info" }),
    () => toast({ title: "Couldn't copy", description: text, tone: "error" }),
  );
}

/** Decorative, deterministic QR-like pattern. Clearly labelled as non-payable. */
function DemoQr() {
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21;
    const y = Math.floor(i / 21);
    const finder = (cx: number, cy: number) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7 && (x === cx || x === cx + 6 || y === cy || y === cy + 6 || (x >= cx + 2 && x <= cx + 4 && y >= cy + 2 && y <= cy + 4));
    if (finder(0, 0) || finder(14, 0) || finder(0, 14)) return true;
    if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) return false;
    return ((x * 7 + y * 13 + x * y) % 5) < 2;
  });
  return (
    <div className="relative">
      <svg viewBox="0 0 21 21" className="size-36 rounded-lg bg-surface p-2 ring-1 ring-line" aria-label="Demo QR code (not payable)" role="img" shapeRendering="crispEdges">
        {cells.map((on, i) => (on ? <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#0d1b2a" /> : null))}
      </svg>
      <span className="absolute inset-x-0 -bottom-2 mx-auto w-fit rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-ink">DEMO · NOT PAYABLE</span>
    </div>
  );
}

export function SubscribeView() {
  const params = useSearchParams();
  const initialPlan = Number(params.get("plan"));
  return <Subscribe initialPlan={[30, 90, 365].includes(initialPlan) ? (initialPlan as PlanDays) : 90} />;
}

function Subscribe({ initialPlan }: { initialPlan: PlanDays }) {
  const { state, ready, learner, sub, now } = useSession();
  const plans = state.plans.filter((p) => p.enabled);
  const [planDays, setPlanDays] = useState<PlanDays>(plans.some((p) => p.days === initialPlan) ? initialPlan : plans[0]?.days ?? 90);
  const plan = state.plans.find((p) => p.days === planDays) ?? plans[0];
  const [payTab, setPayTab] = useState<PaymentMethod>("upi");

  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [amount, setAmount] = useState<string>("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ amount?: string; reference?: string; file?: string }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const amountValue = amount === "" ? plan?.price ?? 0 : Number(amount);
  const monthly = state.plans.find((p) => p.days === 30)?.price ?? 0;
  const projectedExpiry = (sub.status === "active" && sub.expiresAt ? sub.expiresAt : now) + planDays * DAY;
  const submitted = submittedId ? state.requests.find((r) => r.id === submittedId) : undefined;

  const validate = () => {
    const errs: typeof errors = {};
    if (!Number.isFinite(amountValue) || amountValue <= 0) errs.amount = "Enter the amount you paid";
    const ref = reference.trim();
    if (!ref) errs.reference = "Enter the transaction or reference ID";
    else if (method === "upi" && !/^\d{12}$/.test(ref)) errs.reference = "UPI transaction IDs (UTR) are 12 digits";
    else if (method === "bank" && !/^[A-Za-z0-9-]{6,22}$/.test(ref)) errs.reference = "Enter a valid NEFT/IMPS reference (6–22 letters or digits)";
    if (file && file.size > 5 * 1024 * 1024) errs.file = "Screenshot must be smaller than 5 MB";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validate()) setConfirmOpen(true);
  };

  const confirm = () => {
    if (!learner || !plan) return;
    const id = submitActivationRequest({
      learnerId: learner.id,
      planDays,
      amount: amountValue,
      method,
      reference: reference.trim(),
      screenshotName: file?.name,
      note: note.trim() || undefined,
    });
    setConfirmOpen(false);
    setSubmittedId(id);
    setReference("");
    setNote("");
    setFile(null);
    toast({ title: "Activation request submitted", description: "Status: Pending admin verification.", simulated: true });
  };

  return (
    <>
      <section className="relative overflow-hidden bg-linear-to-br from-brand-700 via-brand-700 to-brand-900 text-white">
        <div className="bg-grid-faint absolute inset-0 opacity-40" />
        <div className="absolute -top-20 -right-20 size-80 rounded-full bg-white/10" />
        <div className="container-page relative py-12 text-center sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/25">
            <Crown className="size-3.5 text-amber-300" /> All-access subscription
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-balance text-white sm:text-5xl">One plan. Every course and test unlocked.</h1>
          <p className="mx-auto mt-3 max-w-xl text-brand-50/85">Choose a duration, pay by UPI or bank transfer, then submit your payment reference. Access starts when our team approves it.</p>
          <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-brand-50">
            {["All published lessons", "All regular practice tests", "Solutions when released", "Progress & attempt history"].map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <Check className="size-4 text-brand-200" /> {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="container-page space-y-10 py-10">
        {ready && learner && (
          <StatusStrip />
        )}

        {/* Step 1 */}
        <section aria-labelledby="step1">
          <StepTitle n={1} id="step1" title="Choose your duration" />
          <div role="radiogroup" aria-labelledby="step1" className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((p) => {
              const selected = p.days === planDays;
              const perMonth = Math.round(p.price / (p.days / 30));
              const save = monthly ? Math.round((1 - perMonth / monthly) * 100) : 0;
              return (
                <button
                  key={p.days}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setPlanDays(p.days);
                    setAmount("");
                  }}
                  className={cn(
                    "relative rounded-2xl border-2 bg-surface p-5 text-left transition-all",
                    selected ? "border-brand-500 shadow-lift ring-4 ring-brand-100 dark:ring-brand-400/20" : "border-line hover:border-brand-200 dark:hover:border-brand-400/30",
                  )}
                >
                  {p.days === 90 && <span className="absolute -top-3 right-5 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-bold text-white">Most popular</span>}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-brand-700 dark:text-brand-300">{p.label}</span>
                    <span className={cn("grid size-5 place-items-center rounded-full border-2", selected ? "border-brand-600 bg-brand-600" : "border-slate-300")}>
                      {selected && <Check className="size-3 text-white" strokeWidth={3} />}
                    </span>
                  </div>
                  <p className="mt-3 text-3xl font-extrabold text-fg">{formatINR(p.price)}</p>
                  <p className="text-sm text-slate-500">{p.days} days of full access</p>
                  <p className="mt-3 text-xs text-slate-500">
                    ≈ {formatINR(perMonth)}/month {save > 0 && <span className="font-bold text-emerald-600 dark:text-emerald-400">· save {save}%</span>}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.15fr]">
          {/* Step 2 */}
          <section aria-labelledby="step2">
            <StepTitle n={2} id="step2" title="Pay outside StudyVerse" />
            <Card className="mt-5 p-5">
              <div className="flex items-center justify-between rounded-xl bg-brand-50 dark:bg-brand-400/10 px-4 py-3">
                <span className="text-sm font-semibold text-brand-900 dark:text-brand-100">Amount to pay</span>
                <span className="text-2xl font-extrabold text-brand-800 dark:text-brand-200">{plan ? formatINR(plan.price) : "—"}</span>
              </div>
              <Segmented
                label="Payment method"
                className="mt-4 w-full"
                value={payTab}
                onChange={setPayTab}
                options={[
                  { value: "upi", label: <span className="inline-flex items-center gap-1.5"><Smartphone className="size-4" /> UPI</span> },
                  { value: "bank", label: <span className="inline-flex items-center gap-1.5"><Building2 className="size-4" /> Bank transfer</span> },
                ]}
              />
              {payTab === "upi" ? (
                <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                  <DemoQr />
                  <div className="w-full flex-1 space-y-3">
                    <CopyRow label="UPI ID" value={state.payment.upiId} />
                    <CopyRow label="Payee name" value={state.payment.payeeName} />
                    <p className="text-xs leading-relaxed text-slate-500">
                      Pay using any UPI app (GPay, PhonePe, Paytm, BHIM). After paying, note the 12-digit <strong>UPI transaction ID (UTR)</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <CopyRow label="Bank" value={state.payment.bankName} />
                  <CopyRow label="Account name" value={state.payment.accountName} />
                  <CopyRow label="Account number" value={state.payment.accountNumber} />
                  <CopyRow label="IFSC" value={state.payment.ifsc} />
                  <p className="text-xs leading-relaxed text-slate-500">Use NEFT or IMPS. Keep the bank reference number for your request.</p>
                </div>
              )}
              <SimulatedNote className="mt-5">Demo payment details — do not send real money. No payment is processed or verified in the prototype.</SimulatedNote>
            </Card>
            <ul className="mt-5 space-y-2 text-sm">
              {state.payment.terms.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-slate-600">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" /> {t}
                </li>
              ))}
            </ul>
          </section>

          {/* Step 3 */}
          <section aria-labelledby="step3">
            <StepTitle n={3} id="step3" title="Submit your payment details" />
            <div className="mt-5">
              {!ready ? (
                <Skeleton className="h-96 w-full rounded-2xl" />
              ) : !learner ? (
                <UnlockPrompt learner={undefined} sub={sub} next={`/subscribe?plan=${planDays}`} what="activation requests" />
              ) : submitted ? (
                <Card className="p-6 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Clock className="size-7" />
                  </span>
                  <h3 className="mt-4 text-xl font-extrabold">Request submitted</h3>
                  <p className="mt-1 text-sm text-slate-500">We&apos;ll verify your payment and activate your plan. You&apos;ll see the status change on your dashboard.</p>
                  <dl className="mx-auto mt-5 max-w-sm space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm">
                    <Row k="Status" v={<Badge tone="amber" dot>Pending</Badge>} />
                    <Row k="Plan" v={`${submitted.planDays} days`} />
                    <Row k="Amount" v={formatINR(submitted.amount)} />
                    <Row k="Reference" v={<span className="font-mono">{submitted.reference}</span>} />
                    <Row k="Submitted" v={formatDateTime(submitted.submittedAt)} />
                  </dl>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <ButtonLink href="/dashboard/subscription">View request status</ButtonLink>
                    <ButtonLink href="/courses" variant="secondary">
                      Browse previews meanwhile
                    </ButtonLink>
                  </div>
                  <SimulatedNote className="mt-5 justify-center">To continue the demo, approve this request in the admin console (Prototype controls → Admin session).</SimulatedNote>
                </Card>
              ) : sub.pending ? (
                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Clock className="size-6" />
                    </span>
                    <div>
                      <h3 className="text-lg font-extrabold">You already have a pending request</h3>
                      <p className="mt-1 text-sm text-slate-500">Only one request can be pending at a time. We&apos;ll review it shortly.</p>
                    </div>
                  </div>
                  <dl className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                    <Row k="Plan" v={`${sub.pending.planDays} days`} />
                    <Row k="Amount" v={formatINR(sub.pending.amount)} />
                    <Row k="Method" v={sub.pending.method === "upi" ? "UPI" : "Bank transfer"} />
                    <Row k="Reference" v={<span className="font-mono">{sub.pending.reference}</span>} />
                    <Row k="Submitted" v={formatDateTime(sub.pending.submittedAt)} />
                  </dl>
                  <ButtonLink href="/dashboard/subscription" variant="secondary" className="mt-5">
                    View request history
                  </ButtonLink>
                </Card>
              ) : (
                <Card className="p-5 sm:p-6">
                  <form onSubmit={onSubmit} noValidate className="space-y-5">
                    {sub.status === "active" && sub.expiresAt && (
                      <Callout tone="info" title="Renewing an active plan">
                        Your current plan runs until {formatDate(sub.expiresAt)}. If approved, {planDays} days are added on top — new expiry about {formatDate(projectedExpiry)}.
                      </Callout>
                    )}
                    <fieldset>
                      <legend className="mb-2 text-sm font-semibold text-fg">Payment method</legend>
                      <Segmented
                        label="Payment method used"
                        value={method}
                        onChange={(m) => {
                          setMethod(m);
                          setErrors((e) => ({ ...e, reference: undefined }));
                        }}
                        options={[
                          { value: "upi", label: "UPI" },
                          { value: "bank", label: "Bank transfer" },
                        ]}
                        className="w-full"
                      />
                    </fieldset>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Plan">
                        {(p) => <Input {...p} readOnly value={`${plan?.label} · ${planDays} days`} className="bg-slate-50" />}
                      </Field>
                      <Field label="Amount paid (₹)" error={errors.amount} required hint={plan && amountValue !== plan.price ? `Plan price is ${formatINR(plan.price)}` : undefined}>
                        {(p) => <Input {...p} inputMode="numeric" value={amount === "" ? String(plan?.price ?? "") : amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />}
                      </Field>
                    </div>
                    <Field
                      label={method === "upi" ? "UPI transaction ID (UTR)" : "Bank reference number"}
                      error={errors.reference}
                      required
                      hint={method === "upi" ? "12 digits, found in your UPI app's payment details." : "NEFT/IMPS reference from your bank statement or SMS."}
                    >
                      {(p) => (
                        <Input
                          {...p}
                          value={reference}
                          onChange={(e) => {
                            setReference(e.target.value);
                            if (errors.reference) setErrors((x) => ({ ...x, reference: undefined }));
                          }}
                          placeholder={method === "upi" ? "e.g. 402188761123" : "e.g. NEFT-N310924588"}
                          className="font-mono"
                        />
                      )}
                    </Field>

                    <div>
                      <p className="text-sm font-semibold text-fg">
                        Payment screenshot <span className="font-normal text-slate-400">(optional)</span>
                      </p>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        className="sr-only"
                        id="proof"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setFile(f);
                          setErrors((x) => ({ ...x, file: f && f.size > 5 * 1024 * 1024 ? "Screenshot must be smaller than 5 MB" : undefined }));
                        }}
                      />
                      {file ? (
                        <div className={cn("mt-2 flex items-center gap-3 rounded-xl border p-3", errors.file ? "border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10" : "border-line bg-slate-50")}>
                          <FileImage className="size-5 text-brand-600 dark:text-brand-400" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-fg">{file.name}</p>
                            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB · stays in your browser</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFile(null);
                              if (fileRef.current) fileRef.current.value = "";
                              setErrors((x) => ({ ...x, file: undefined }));
                            }}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-surface hover:text-red-600 dark:hover:text-red-400"
                            aria-label="Remove screenshot"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <label htmlFor="proof" className="mt-2 flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line-strong px-4 py-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-400/10">
                          <Paperclip className="size-5 text-slate-400" />
                          <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">Attach screenshot</span>
                          <span className="text-xs text-slate-500">PNG, JPG or PDF up to 5 MB</span>
                        </label>
                      )}
                      {errors.file && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.file}</p>}
                    </div>

                    <Field label="Note for the admin (optional)">
                      {(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid from a parent's account" />}
                    </Field>

                    {sub.lastRejected && (
                      <Callout tone="danger" icon={<TriangleAlert />} title="Your previous request was rejected">
                        {sub.lastRejected.rejectionReason}
                      </Callout>
                    )}

                    <Button type="submit" block size="lg">
                      Submit activation request
                    </Button>
                    <SimulatedNote>Submitting does not grant access. Access starts only after an admin approves the request.</SimulatedNote>
                  </form>
                </Card>
              )}
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm your request"
        description="Please check these details match your payment."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Edit details
            </Button>
            <Button onClick={confirm}>Submit request</Button>
          </>
        }
      >
        <dl className="space-y-2.5 text-sm">
          <Row k="Plan" v={`${plan?.label} · ${planDays} days`} />
          <Row k="Amount paid" v={formatINR(amountValue)} />
          <Row k="Method" v={method === "upi" ? "UPI" : "Bank transfer"} />
          <Row k="Reference" v={<span className="font-mono">{reference.trim()}</span>} />
          <Row k="Screenshot" v={file?.name ?? "Not attached"} />
        </dl>
        {plan && amountValue !== plan.price && (
          <Callout tone="warning" className="mt-4">
            The amount differs from the plan price ({formatINR(plan.price)}). The admin may reject mismatched payments.
          </Callout>
        )}
        <p className="mt-4 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
          <FlaskConical className="mt-px size-3.5 shrink-0" /> Prototype: the request is stored only in this browser.
        </p>
      </Modal>
    </>
  );
}

function StatusStrip() {
  const { sub } = useSession();
  if (sub.status === "active" && sub.expiresAt) {
    return (
      <Callout tone="success" icon={<CircleCheck />} title={`Your subscription is active until ${formatDate(sub.expiresAt)}`} action={<ButtonLink href="/dashboard/subscription" size="sm" variant="secondary">Manage</ButtonLink>}>
        {sub.daysLeft} days left. Renewing now extends your expiry — unused days are never lost.
      </Callout>
    );
  }
  if (sub.status === "expired" && sub.expiresAt && !sub.pending) {
    return (
      <Callout tone="danger" icon={<TriangleAlert />} title={`Your subscription expired on ${formatDate(sub.expiresAt)}`}>
        Your progress and history are safe. Choose a plan below to renew.
      </Callout>
    );
  }
  return null;
}

function StepTitle({ n, title, id }: { n: number; title: string; id: string }) {
  return (
    <h2 id={id} className="flex items-center gap-3 text-xl font-extrabold">
      <span className="grid size-8 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white">{n}</span>
      {title}
    </h2>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
        <p className="truncate font-mono text-sm font-bold text-fg">{value}</p>
      </div>
      <button type="button" onClick={() => copy(value, label)} className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-700 dark:hover:text-brand-300" aria-label={`Copy ${label}`}>
        <Copy className="size-4" />
      </button>
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
