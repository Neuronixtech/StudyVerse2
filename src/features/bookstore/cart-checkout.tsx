"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Info, LockKeyhole, MapPin, Minus, Pencil, Plus, ShoppingCart, Trash2, TriangleAlert } from "lucide-react";
import { BookMetaChips, PriceTag, PrimaryPhoto } from "@/components/bookstore/book-visuals";
import { AddressBlock, TotalsBlock } from "@/components/bookstore/order-ui";
import { Breadcrumbs } from "@/components/page-banner";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardHeader, EmptyState, SimulatedNote, Skeleton } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { cartLines, INDIAN_STATES, isValidPin, totalsFor } from "@/lib/bookstore";
import { cartKey, placeOrder, removeFromCart, saveAddress, setCartQty } from "@/lib/bookstore-store";
import { useSession } from "@/lib/hooks";
import type { Address } from "@/lib/types";
import { cn, formatINR, isValidIndianPhone } from "@/lib/utils";

/* ---------------------------- Address form ---------------------------- */

type AddressDraft = Omit<Address, "id" | "learnerId">;

export function AddressForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Save address",
}: {
  initial?: Partial<AddressDraft>;
  onSubmit: (a: AddressDraft) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [v, setV] = useState<AddressDraft>({
    fullName: initial?.fullName ?? "",
    mobile: initial?.mobile ?? "",
    line1: initial?.line1 ?? "",
    locality: initial?.locality ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    pin: initial?.pin ?? "",
    instructions: initial?.instructions ?? "",
    isDefault: initial?.isDefault ?? false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof AddressDraft, string>>>({});
  const set = <K extends keyof AddressDraft>(k: K, val: AddressDraft[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (v.fullName.trim().length < 2) errs.fullName = "Enter the recipient's full name";
    if (!isValidIndianPhone(v.mobile)) errs.mobile = "Enter a valid 10-digit mobile number";
    if (v.line1.trim().length < 5) errs.line1 = "Enter house/building and street";
    if (!v.locality.trim()) errs.locality = "Enter the locality or area";
    if (!v.city.trim()) errs.city = "Enter the city";
    if (!v.state) errs.state = "Choose a state";
    if (!isValidPin(v.pin)) errs.pin = "Enter a valid 6-digit PIN code";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({ ...v, fullName: v.fullName.trim(), line1: v.line1.trim(), locality: v.locality.trim(), city: v.city.trim(), pin: v.pin.trim(), instructions: v.instructions?.trim() || undefined });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.fullName} required>
          {(p) => <Input {...p} autoComplete="name" value={v.fullName} onChange={(e) => set("fullName", e.target.value)} />}
        </Field>
        <Field label="Mobile number" error={errors.mobile} required>
          {(p) => <Input {...p} type="tel" autoComplete="tel" value={v.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="98765 43210" />}
        </Field>
      </div>
      <Field label="House / building and street" error={errors.line1} required>
        {(p) => <Input {...p} autoComplete="address-line1" value={v.line1} onChange={(e) => set("line1", e.target.value)} />}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Locality / area" error={errors.locality} required>
          {(p) => <Input {...p} autoComplete="address-line2" value={v.locality} onChange={(e) => set("locality", e.target.value)} />}
        </Field>
        <Field label="City" error={errors.city} required>
          {(p) => <Input {...p} autoComplete="address-level2" value={v.city} onChange={(e) => set("city", e.target.value)} />}
        </Field>
        <Field label="State" error={errors.state} required>
          {(p) => (
            <Select {...p} value={v.state} onChange={(e) => set("state", e.target.value)}>
              <option value="">Choose state</option>
              {INDIAN_STATES.map((st) => (
                <option key={st}>{st}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="PIN code" error={errors.pin} required>
          {(p) => <Input {...p} inputMode="numeric" autoComplete="postal-code" maxLength={6} value={v.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))} />}
        </Field>
      </div>
      <Field label="Delivery instructions (optional)">
        {(p) => <Textarea {...p} rows={2} value={v.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="e.g. Call before delivery" />}
      </Field>
      <Checkbox checked={v.isDefault} onChange={(e) => set("isDefault", e.target.checked)} label="Make this my default address" />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

/* -------------------------------- Cart -------------------------------- */

export function CartPage() {
  const { state, ready, learner, now } = useSession();
  const key = cartKey(learner?.id);
  const lines = cartLines(state.carts[key] ?? [], state.books, state.bookOrders, now);
  const valid = lines.filter((l) => !l.problem && l.book);
  const totals = totalsFor(
    lines.filter((l) => l.book).map((l) => ({ qty: l.item.qty, unitPrice: l.book!.price, mrp: l.book!.mrp })),
    state.bookstore,
  );
  const blocked = lines.some((l) => l.problem);

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ href: "/books", label: "Bookstore" }, { label: "Cart" }]} />
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Your cart</h1>
      {!ready ? (
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      ) : lines.length === 0 ? (
        <EmptyState className="mt-6" icon={<ShoppingCart />} title="Your cart is empty" description="Browse workbooks, solved papers and revision notes." action={<ButtonLink href="/books">Visit the bookstore</ButtonLink>} />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-4">
            {blocked && (
              <Callout tone="warning" title="Some items need your attention">
                Stock has changed for items in your cart. Adjust the quantity or remove them to continue — we never remove items for you.
              </Callout>
            )}
            {!learner && (
              <Callout tone="info" icon={<Info />}>
                You can shop as a guest. You&apos;ll log in at checkout and your cart will be kept.
              </Callout>
            )}
            <Card>
              <ul className="divide-y divide-line">
                {lines.map(({ item, book, available, problem }) => (
                  <li key={item.bookId} className="flex gap-4 p-4">
                    {book ? (
                      <Link href={`/books/${book.slug}`} className="w-20 shrink-0">
                        <PrimaryPhoto book={book} size="sm" />
                      </Link>
                    ) : (
                      <div className="aspect-[3/4] w-20 shrink-0 rounded-lg bg-slate-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      {book && <BookMetaChips book={book} />}
                      <p className="mt-0.5 font-bold text-fg">{book ? <Link href={`/books/${book.slug}`} className="hover:text-brand-700 dark:hover:text-brand-300">{book.title}</Link> : "Unavailable book"}</p>
                      {book && <p className="text-xs text-slate-500">{[book.author, book.language, book.edition].filter(Boolean).join(" · ")}</p>}
                      {book && (
                        <div className="mt-2">
                          <PriceTag mrp={book.mrp} price={book.price} size="sm" />
                        </div>
                      )}
                      {problem && (
                        <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">
                          <TriangleAlert className="mt-px size-3.5 shrink-0" />
                          {problem === "unavailable"
                            ? "This book is no longer available. Remove it to continue."
                            : problem === "out_of_stock"
                              ? "Out of stock right now. Remove it to continue."
                              : `Only ${available} available. Reduce the quantity to continue.`}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <div className="flex items-center rounded-lg border border-line-strong" role="group" aria-label={`Quantity for ${book?.title ?? "item"}`}>
                          <button type="button" onClick={() => setCartQty(key, item.bookId, item.qty - 1)} disabled={item.qty <= 1} className="grid size-9 place-items-center text-slate-600 disabled:opacity-40" aria-label="Decrease quantity">
                            <Minus className="size-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-fg tabular-nums">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => setCartQty(key, item.bookId, item.qty + 1)}
                            disabled={!book || item.qty >= Math.min(10, available)}
                            className="grid size-9 place-items-center text-slate-600 disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            removeFromCart(key, item.bookId);
                            toast({ title: "Removed from cart", tone: "info" });
                          }}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Trash2 className="size-4" /> Remove
                        </button>
                      </div>
                    </div>
                    <p className="shrink-0 text-right font-bold text-fg">{book ? formatINR(book.price * item.qty) : "—"}</p>
                  </li>
                ))}
              </ul>
            </Card>
            <Link href="/books/catalog" className="inline-block text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">
              ← Continue shopping
            </Link>
          </div>
          <aside>
            <Card className="p-5 lg:sticky lg:top-24">
              <h2 className="text-base font-bold">Order summary</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {lines.reduce((a, l) => a + l.item.qty, 0)} item(s) · {valid.length} of {lines.length} ready to order
              </p>
              <div className="mt-4">
                <TotalsBlock subtotal={totals.subtotal} shipping={totals.shipping} total={totals.total} savings={totals.savings} freeThreshold={state.bookstore.freeShippingThreshold} />
              </div>
              {learner ? (
                <ButtonLink href="/books/checkout" block size="lg" className={cn("mt-5", blocked && "pointer-events-none opacity-50")} aria-disabled={blocked} tabIndex={blocked ? -1 : undefined}>
                  Proceed to checkout <ArrowRight />
                </ButtonLink>
              ) : (
                <ButtonLink href="/login?next=/books/checkout" block size="lg" className={cn("mt-5", blocked && "pointer-events-none opacity-50")} aria-disabled={blocked} tabIndex={blocked ? -1 : undefined}>
                  <LockKeyhole /> Log in to checkout
                </ButtonLink>
              )}
              {blocked && <p className="mt-2 text-center text-xs font-semibold text-red-600 dark:text-red-400">Fix the highlighted items to continue.</p>}
              {!learner && !blocked && <p className="mt-2 text-center text-xs text-slate-500">Your cart is saved while you log in or sign up.</p>}
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Checkout ------------------------------ */

export function CheckoutPage() {
  const router = useRouter();
  const { state, ready, learner, now } = useSession();
  const [chosen, setChosen] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <div className="container-page py-10"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  if (!learner) {
    return (
      <div className="container-page py-20">
        <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 dark:bg-brand-400/10 text-brand-600 dark:text-brand-400">
            <LockKeyhole className="size-7" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold">Log in to check out</h1>
          <p className="mt-2 text-sm text-slate-500">Your cart is saved. After you log in or sign up, you&apos;ll come straight back here.</p>
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ButtonLink href="/login?next=/books/checkout">Log in</ButtonLink>
            <ButtonLink href="/signup?next=/books/checkout" variant="secondary">
              Create account
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const lines = cartLines(state.carts[learner.id] ?? [], state.books, state.bookOrders, now);
  const addresses = state.addresses.filter((a) => a.learnerId === learner.id).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const selected = addresses.find((a) => a.id === chosen) ?? addresses.find((a) => a.isDefault) ?? addresses[0];
  const totals = totalsFor(lines.filter((l) => l.book).map((l) => ({ qty: l.item.qty, unitPrice: l.book!.price, mrp: l.book!.mrp })), state.bookstore);
  const blocked = lines.some((l) => l.problem);

  if (lines.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={<ShoppingCart />} title="Nothing to check out" description="Your cart is empty." action={<ButtonLink href="/books">Visit the bookstore</ButtonLink>} />
      </div>
    );
  }

  const place = () => {
    if (!selected) return;
    const res = placeOrder(learner.id, selected.id);
    setConfirmOpen(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast({ title: "Order placed", description: `Stock reserved for ${state.bookstore.reservationHours} hours. Complete your payment next.`, simulated: true });
    router.push(`/books/orders/${res.id}/payment`);
  };

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ href: "/books", label: "Bookstore" }, { href: "/books/cart", label: "Cart" }, { label: "Checkout" }]} />
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Checkout</h1>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {error && <Callout tone="danger" title="Couldn't place the order">{error}</Callout>}
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><MapPin className="size-4 text-brand-600 dark:text-brand-400" /> Delivery address</span>}
              description="We deliver across India."
              action={
                <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                  <Plus /> Add address
                </Button>
              }
            />
            {addresses.length === 0 ? (
              <div className="p-5">
                <p className="mb-4 text-sm text-slate-500">Add a delivery address to continue.</p>
                <AddressForm
                  initial={{ fullName: learner.name, mobile: learner.phone.replace(/^\+91\s?/, "").replace(/\s/g, ""), isDefault: true }}
                  submitLabel="Save and use this address"
                  onSubmit={(a) => {
                    const id = saveAddress(learner.id, a);
                    setChosen(id);
                    toast({ title: "Address saved" });
                  }}
                />
              </div>
            ) : (
              <div role="radiogroup" aria-label="Delivery address" className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                {addresses.map((a) => {
                  const active = selected?.id === a.id;
                  return (
                    <div key={a.id} className={cn("relative rounded-xl border-2 p-4 transition-colors", active ? "border-brand-500 bg-brand-50/50 dark:bg-brand-400/10" : "border-line hover:border-brand-200 dark:hover:border-brand-400/30")}>
                      <button type="button" role="radio" aria-checked={active} onClick={() => setChosen(a.id)} className="absolute inset-0 rounded-xl" aria-label={`Deliver to ${a.fullName}, ${a.city}`} />
                      <div className="pointer-events-none flex items-start justify-between gap-2">
                        <AddressBlock address={a} />
                        <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", active ? "border-brand-600 bg-brand-600" : "border-slate-300")}>
                          {active && <Check className="size-3 text-white" strokeWidth={3} />}
                        </span>
                      </div>
                      <div className="relative mt-3 flex items-center gap-2">
                        {a.isDefault && <Badge tone="brand" size="xs">Default</Badge>}
                        <button type="button" onClick={() => setEditing(a)} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline">
                          <Pencil className="size-3" /> Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Items" description="One combined order — all books ship together." action={<Link href="/books/cart" className="text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">Edit cart</Link>} />
            <ul className="divide-y divide-line">
              {lines.map(({ item, book, available, problem }) => (
                <li key={item.bookId} className="flex items-center gap-3 px-5 py-3">
                  {book && <PrimaryPhoto book={book} size="xs" className="w-10 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{book?.title ?? "Unavailable book"}</p>
                    <p className="text-xs text-slate-500">
                      {item.qty} × {book ? formatINR(book.price) : "—"}
                    </p>
                    {problem && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{problem === "insufficient" ? `Only ${available} available` : "Unavailable — remove from cart"}</p>}
                  </div>
                  <p className="text-sm font-bold text-fg">{book ? formatINR(book.price * item.qty) : "—"}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-bold">Payment</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manual payment by UPI or bank transfer. After you place the order you&apos;ll see the payment details, then submit your transaction reference. Your books are reserved for {state.bookstore.reservationHours} hours from order placement.
            </p>
          </Card>
        </div>

        <aside>
          <Card className="p-5 lg:sticky lg:top-24">
            <h2 className="text-base font-bold">Order total</h2>
            <div className="mt-4">
              <TotalsBlock subtotal={totals.subtotal} shipping={totals.shipping} total={totals.total} savings={totals.savings} freeThreshold={state.bookstore.freeShippingThreshold} />
            </div>
            <Button block size="lg" className="mt-5" disabled={blocked || !selected} onClick={() => setConfirmOpen(true)}>
              Place order · {formatINR(totals.total)}
            </Button>
            {blocked && (
              <p className="mt-2 text-center text-xs font-semibold text-red-600 dark:text-red-400">
                Update your cart: some items are unavailable. <Link href="/books/cart" className="underline">Go to cart</Link>
              </p>
            )}
            {!selected && <p className="mt-2 text-center text-xs text-slate-500">Add a delivery address to continue.</p>}
            <SimulatedNote className="mt-4">Placing an order is simulated — no payment is taken and nothing ships.</SimulatedNote>
          </Card>
        </aside>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add delivery address" size="lg">
        <AddressForm
          initial={{ fullName: learner.name }}
          onCancel={() => setAddOpen(false)}
          onSubmit={(a) => {
            const id = saveAddress(learner.id, a);
            setChosen(id);
            setAddOpen(false);
            toast({ title: "Address added" });
          }}
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit address" size="lg">
        {editing && (
          <AddressForm
            key={editing.id}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(a) => {
              saveAddress(learner.id, a, editing.id);
              setEditing(null);
              toast({ title: "Address updated" });
            }}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={place}
        title={`Place order for ${formatINR(totals.total)}?`}
        description={`Your books will be reserved for ${state.bookstore.reservationHours} hours. Pay by UPI or bank transfer and submit your transaction reference within that time.`}
        confirmLabel="Place order"
      >
        {selected && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-1 text-xs font-semibold text-slate-500">Delivering to</p>
            <AddressBlock address={selected} />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
