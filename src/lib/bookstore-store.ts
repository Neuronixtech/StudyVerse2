"use client";

/* ------------------------------------------------------------------
   Bookstore actions (prototype — mock data in the browser only).
   No payment, courier, refund or email actually happens.
------------------------------------------------------------------- */

import { amountPaid, availableStock, cartLines, nextOrderNumber, reservationState, totalsFor } from "./bookstore";
import type { AppState } from "./mock/seed";
import { audit, getState, setState } from "./store";
import type {
  Address,
  AddressSnapshot,
  Book,
  BookOrder,
  BookPermission,
  BookstoreSettings,
  OrderItem,
  PaymentMethod,
  Refund,
  ReturnReason,
  Shipment,
  StockMovement,
} from "./types";
import { HOUR, formatINR, uid } from "./utils";

export const cartKey = (learnerId: string | null | undefined) => learnerId ?? "guest";

type Result = { ok: true; id?: string } | { ok: false; error: string };

/* ------------------------------ helpers ------------------------------ */

const adminName = (s: AppState, adminId: string) => s.admins.find((a) => a.id === adminId)?.name ?? "Admin";

function updateOrder(s: AppState, orderId: string, fn: (o: BookOrder) => BookOrder): AppState {
  return { ...s, bookOrders: s.bookOrders.map((o) => (o.id === orderId ? fn(o) : o)) };
}

function withEvent(o: BookOrder, text: string, actor: string, customerVisible = true): BookOrder {
  return { ...o, events: [...o.events, { id: uid("ev"), at: Date.now(), actor, text, customerVisible }] };
}

function notify(s: AppState, learnerId: string, title: string, body: string, href?: string): AppState {
  return {
    ...s,
    notifications: [{ id: uid("nt"), learnerId, at: Date.now(), title, body, href, read: false, email: true }, ...s.notifications].slice(0, 200),
  };
}

function moveStock(s: AppState, bookId: string, delta: number, kind: StockMovement["kind"], reason: string, actor: string, orderId?: string): AppState {
  if (delta === 0 && kind !== "correction") return s;
  return {
    ...s,
    books: s.books.map((b) => (b.id === bookId ? { ...b, stock: Math.max(0, b.stock + delta), sold: kind === "sale" ? b.sold - delta : b.sold } : b)),
    stockMovements: [{ id: uid("mv"), bookId, at: Date.now(), delta, kind, reason, actor, orderId }, ...s.stockMovements],
  };
}

const orderHref = (id: string) => `/dashboard/orders/${id}`;

/* -------------------------------- Cart -------------------------------- */

export function addToCart(key: string, bookId: string, qty = 1) {
  setState((s) => {
    const cart = [...(s.carts[key] ?? [])];
    const line = cart.find((c) => c.bookId === bookId);
    if (line) line.qty += qty;
    else cart.push({ bookId, qty, addedAt: Date.now() });
    return { ...s, carts: { ...s.carts, [key]: cart.map((c) => ({ ...c })) } };
  });
}

export function setCartQty(key: string, bookId: string, qty: number) {
  setState((s) => ({
    ...s,
    carts: { ...s.carts, [key]: (s.carts[key] ?? []).map((c) => (c.bookId === bookId ? { ...c, qty: Math.max(1, qty) } : c)) },
  }));
}

export function removeFromCart(key: string, bookId: string) {
  setState((s) => ({ ...s, carts: { ...s.carts, [key]: (s.carts[key] ?? []).filter((c) => c.bookId !== bookId) } }));
}

/* ------------------------------ Addresses ------------------------------ */

export function saveAddress(learnerId: string, data: Omit<Address, "id" | "learnerId">, id?: string): string {
  const addressId = id ?? uid("ad");
  setState((s) => {
    const mine = s.addresses.filter((a) => a.learnerId === learnerId);
    const makeDefault = data.isDefault || mine.length === 0 || (mine.length === 1 && mine[0].id === id);
    let addresses = id
      ? s.addresses.map((a) => (a.id === id ? { ...a, ...data, isDefault: makeDefault } : a))
      : [...s.addresses, { ...data, id: addressId, learnerId, isDefault: makeDefault }];
    if (makeDefault) addresses = addresses.map((a) => (a.learnerId === learnerId && a.id !== addressId ? { ...a, isDefault: false } : a));
    return { ...s, addresses };
  });
  return addressId;
}

export function setDefaultAddress(learnerId: string, id: string) {
  setState((s) => ({ ...s, addresses: s.addresses.map((a) => (a.learnerId === learnerId ? { ...a, isDefault: a.id === id } : a)) }));
}

export function deleteAddress(learnerId: string, id: string) {
  setState((s) => {
    const removed = s.addresses.find((a) => a.id === id);
    let addresses = s.addresses.filter((a) => a.id !== id);
    if (removed?.isDefault) {
      const first = addresses.find((a) => a.learnerId === learnerId);
      if (first) addresses = addresses.map((a) => (a.id === first.id ? { ...a, isDefault: true } : a));
    }
    return { ...s, addresses };
  });
}

const snapshot = (a: Address): AddressSnapshot => ({
  fullName: a.fullName, mobile: a.mobile, line1: a.line1, locality: a.locality, city: a.city, state: a.state, pin: a.pin, instructions: a.instructions,
});

/* ------------------------------ Checkout ------------------------------ */

export function placeOrder(learnerId: string, addressId: string): Result {
  const s = getState();
  const now = Date.now();
  const address = s.addresses.find((a) => a.id === addressId && a.learnerId === learnerId);
  if (!address) return { ok: false, error: "Choose a delivery address." };
  const lines = cartLines(s.carts[learnerId] ?? [], s.books, s.bookOrders, now);
  if (!lines.length) return { ok: false, error: "Your cart is empty." };
  if (lines.some((l) => l.problem)) return { ok: false, error: "Some items are unavailable or exceed available stock. Update your cart to continue." };

  const items: OrderItem[] = lines.map(({ item, book }) => ({
    bookId: book!.id, title: book!.title, author: book!.author, isbn: book!.isbn, edition: book!.edition, language: book!.language,
    theme: book!.theme, qty: item.qty, unitPrice: book!.price, mrp: book!.mrp,
  }));
  const t = totalsFor(items, s.bookstore);
  const id = uid("o");
  const number = nextOrderNumber(s.bookOrders);
  const order: BookOrder = {
    id, number, learnerId, createdAt: now, items, subtotal: t.subtotal, shipping: t.shipping, total: t.total, address: snapshot(address),
    status: "pending_payment", reservationExpiresAt: now + s.bookstore.reservationHours * HOUR, payments: [], refunds: [],
    events: [{ id: uid("ev"), at: now, actor: "Customer", text: `Order placed. Stock reserved for ${s.bookstore.reservationHours} hours while you complete payment.`, customerVisible: true }],
  };
  setState((st) =>
    notify(
      { ...st, bookOrders: [order, ...st.bookOrders], carts: { ...st.carts, [learnerId]: [] } },
      learnerId,
      `Order ${number} placed`,
      `Pay ${formatINR(t.total)} by UPI or bank transfer and submit your payment details within ${st.bookstore.reservationHours} hours.`,
      `/books/orders/${id}/payment`,
    ),
  );
  return { ok: true, id };
}

export function submitBookPayment(orderId: string, data: { method: PaymentMethod; reference: string; amount: number; screenshotName?: string }): Result {
  const s = getState();
  const now = Date.now();
  const order = s.bookOrders.find((o) => o.id === orderId);
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "pending_payment" && order.status !== "payment_rejected") return { ok: false, error: "This order isn't awaiting payment." };
  const expired = reservationState(order, now) === "expired";
  if (expired) {
    const short = order.items.find((i) => {
      const b = s.books.find((x) => x.id === i.bookId);
      return !b || availableStock(b, s.bookOrders, now, order.id) < i.qty;
    });
    if (short) return { ok: false, error: `The reservation has expired and “${short.title}” no longer has enough stock. Cancel this order or contact support.` };
  }
  setState((st) => {
    let next = updateOrder(st, orderId, (o) => {
      let u: BookOrder = {
        ...o,
        status: "payment_verification",
        reservationExpiresAt: expired ? now + st.bookstore.reservationHours * HOUR : o.reservationExpiresAt,
        payments: [...o.payments, { id: uid("pay"), submittedAt: now, method: data.method, reference: data.reference, amount: data.amount, screenshotName: data.screenshotName, status: "submitted" }],
      };
      u = withEvent(u, `Payment details submitted (${data.method === "upi" ? "UPI" : "bank"} ref ${data.reference}, ${formatINR(data.amount)}). Awaiting verification.`, "Customer");
      return u;
    });
    next = notify(next, order.learnerId, `Payment details received for ${order.number}`, "We'll verify the transfer in our account. Your stock stays reserved meanwhile.", orderHref(orderId));
    return next;
  });
  return { ok: true };
}

export function cancelOrderByCustomer(orderId: string, reason: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o || (o.status !== "pending_payment" && o.status !== "payment_rejected")) return s;
    const next = updateOrder(s, orderId, (x) =>
      withEvent({ ...x, status: "cancelled", cancellation: { requestedAt: Date.now(), reason, status: "approved", decidedBy: "Customer", decidedAt: Date.now() } }, "Order cancelled by customer before payment. Reserved stock released.", "Customer"),
    );
    return notify(next, o.learnerId, `Order ${o.number} cancelled`, "Your order was cancelled and the reserved books were released.", orderHref(orderId));
  });
}

export function requestCancellation(orderId: string, reason: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o) return s;
    const next = updateOrder(s, orderId, (x) => withEvent({ ...x, cancellation: { requestedAt: Date.now(), reason, status: "requested" } }, "Cancellation requested. An admin will review it before dispatch.", "Customer"));
    return notify(next, o.learnerId, `Cancellation requested for ${o.number}`, "We'll review your request and let you know.", orderHref(orderId));
  });
}

export function requestReturn(orderId: string, data: { reason: ReturnReason; details: string; photos: string[]; preference: "replacement" | "refund" }) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o) return s;
    const next = updateOrder(s, orderId, (x) =>
      withEvent({ ...x, returnRequest: { ...data, requestedAt: Date.now(), status: "requested" } }, `Return requested (${data.preference} preferred). Awaiting admin review.`, "Customer"),
    );
    return notify(next, o.learnerId, `Return request received for ${o.number}`, "Our team will review your request and photos.", orderHref(orderId));
  });
}

export function markNotificationsRead(learnerId: string) {
  setState((s) => ({ ...s, notifications: s.notifications.map((n) => (n.learnerId === learnerId ? { ...n, read: true } : n)) }));
}

/* --------------------------- Admin: payments --------------------------- */

export function approveBookPayment(orderId: string, paymentId: string, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o || o.status !== "payment_verification") return s;
    const actor = adminName(s, adminId);
    const shortages = o.items.filter((i) => (s.books.find((b) => b.id === i.bookId)?.stock ?? 0) < i.qty);
    let next = updateOrder(s, orderId, (x) => {
      let u: BookOrder = {
        ...x,
        status: "processing",
        payments: x.payments.map((p) => (p.id === paymentId ? { ...p, status: "approved", decidedBy: actor, decidedAt: Date.now() } : p)),
      };
      u = withEvent(u, "Payment confirmed.", actor);
      u = withEvent(u, "Order moved to Processing.", "System");
      if (shortages.length) {
        const reason = `Insufficient stock for ${shortages.map((i) => `“${i.title}”`).join(", ")}. The whole order ships together once restocked.`;
        u = withEvent({ ...u, hold: { reason, at: Date.now(), by: "System" } }, `Order on hold: ${reason}`, "System");
      }
      return u;
    });
    for (const i of o.items) next = moveStock(next, i.bookId, -i.qty, "sale", `Order ${o.number} payment confirmed`, "System", o.id);
    next = notify(next, o.learnerId, `Payment approved for ${o.number}`, "Your payment was verified and the order is being processed.", orderHref(orderId));
    return audit(next, adminId, `Approved payment for ${o.number}`, o.id);
  });
}

export function rejectBookPayment(orderId: string, paymentId: string, reason: string, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o || o.status !== "payment_verification") return s;
    const actor = adminName(s, adminId);
    let next = updateOrder(s, orderId, (x) =>
      withEvent(
        { ...x, status: "payment_rejected", payments: x.payments.map((p) => (p.id === paymentId ? { ...p, status: "rejected", decidedBy: actor, decidedAt: Date.now(), rejectionReason: reason } : p)) },
        `Payment rejected: ${reason} You can correct the details and resubmit against this order.`,
        actor,
      ),
    );
    next = notify(next, o.learnerId, `Payment rejected for ${o.number}`, reason, `/books/orders/${orderId}/payment`);
    return audit(next, adminId, `Rejected payment for ${o.number}`, o.id);
  });
}

/* ---------------------------- Admin: orders ---------------------------- */

export function addOrderNote(orderId: string, note: string, adminId: string, notifyCustomer: boolean) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o) return s;
    let next = updateOrder(s, orderId, (x) => withEvent(x, notifyCustomer ? note : `Internal note: ${note}`, adminName(s, adminId), notifyCustomer));
    if (notifyCustomer) next = notify(next, o.learnerId, `Update on order ${o.number}`, note, orderHref(orderId));
    return next;
  });
}

export function setOrderHold(orderId: string, reason: string | null, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o) return s;
    const actor = adminName(s, adminId);
    let next = updateOrder(s, orderId, (x) =>
      reason
        ? withEvent({ ...x, hold: { reason, at: Date.now(), by: actor } }, `Order on hold: ${reason}`, actor)
        : withEvent({ ...x, hold: undefined }, "Hold released. Your order is back in processing.", actor),
    );
    next = notify(next, o.learnerId, reason ? `Order ${o.number} is on hold` : `Order ${o.number} is back in processing`, reason ?? "We're preparing your books for dispatch.", orderHref(orderId));
    return audit(next, adminId, `${reason ? "Placed" : "Released"} hold on ${o.number}`, o.id);
  });
}

export function adminCancelUnpaidOrder(orderId: string, reason: string, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o || !["pending_payment", "payment_rejected"].includes(o.status)) return s;
    const actor = adminName(s, adminId);
    let next = updateOrder(s, orderId, (x) =>
      withEvent({ ...x, status: "cancelled", cancellation: { requestedAt: Date.now(), reason, status: "approved", decidedBy: actor, decidedAt: Date.now() } }, `Order cancelled: ${reason}`, actor),
    );
    next = notify(next, o.learnerId, `Order ${o.number} cancelled`, reason, orderHref(orderId));
    return audit(next, adminId, `Cancelled unpaid order ${o.number}`, o.id);
  });
}

export function dispatchOrder(orderId: string, data: Omit<Shipment, "dispatchedAt" | "deliveredAt">, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o || o.status !== "processing" || o.hold) return s;
    const actor = adminName(s, adminId);
    const text = data.mode === "self" ? `Dispatched by StudyVerse — reference ${data.tracking}.` : `Shipped via ${data.courier} — tracking ${data.tracking}.`;
    let next = updateOrder(s, orderId, (x) => withEvent({ ...x, status: "shipped", shipment: { ...data, dispatchedAt: Date.now() } }, text, actor));
    next = notify(next, o.learnerId, `Order ${o.number} shipped`, text, orderHref(orderId));
    return audit(next, adminId, `Dispatched ${o.number}`, o.id);
  });
}

export function addTrackingUpdate(orderId: string, text: string, adminId: string) {
  setState((s) => updateOrder(s, orderId, (x) => withEvent(x, text, adminName(s, adminId))));
}

export function markDelivered(orderId: string, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o || o.status !== "shipped" || !o.shipment) return s;
    let next = updateOrder(s, orderId, (x) => withEvent({ ...x, status: "delivered", shipment: { ...x.shipment!, deliveredAt: Date.now() } }, "Delivered.", adminName(s, adminId)));
    next = notify(next, o.learnerId, `Order ${o.number} delivered`, `Report any damaged, defective or incorrect book within ${s.bookstore.returnWindowDays} days.`, orderHref(orderId));
    return audit(next, adminId, `Marked ${o.number} delivered`, o.id);
  });
}

type RefundInput = Pick<Refund, "amount" | "method" | "reference" | "status">;

function addRefund(s: AppState, orderId: string, refund: RefundInput, context: Refund["context"], adminId: string): AppState {
  const actor = adminName(s, adminId);
  return updateOrder(s, orderId, (x) => {
    const r: Refund = { ...refund, id: uid("rf"), context, recordedBy: actor, recordedAt: Date.now(), completedAt: refund.status === "completed" ? Date.now() : undefined };
    const u: BookOrder = { ...x, refunds: [...x.refunds, r] };
    if (context === "adjustment") u.paymentDifference = (u.paymentDifference ?? 0) + refund.amount || undefined;
    if (refund.status === "completed" && context !== "adjustment") u.status = "refunded";
    return withEvent(u, `Refund of ${formatINR(refund.amount)} ${refund.status === "completed" ? "completed" : "recorded (pending)"} via ${refund.method === "upi" ? "UPI" : "bank transfer"}${refund.reference ? ` (ref ${refund.reference})` : ""}.`, actor);
  });
}

export function decideCancellation(orderId: string, approve: boolean, note: string, adminId: string, refund?: RefundInput) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o || o.cancellation?.status !== "requested") return s;
    const actor = adminName(s, adminId);
    let next = updateOrder(s, orderId, (x) => {
      const cancellation = { ...x.cancellation!, status: approve ? ("approved" as const) : ("rejected" as const), decidedBy: actor, decidedAt: Date.now(), note };
      return approve
        ? withEvent({ ...x, cancellation, status: "cancelled" }, `Cancellation approved.${note ? ` ${note}` : ""}`, actor)
        : withEvent({ ...x, cancellation }, `Cancellation request declined: ${note}`, actor);
    });
    if (approve && o.status === "processing") {
      for (const i of o.items) next = moveStock(next, i.bookId, i.qty, "restock", `Order ${o.number} cancelled — returned to stock`, actor, o.id);
    }
    if (approve && refund) next = addRefund(next, orderId, refund, "cancellation", adminId);
    next = notify(next, o.learnerId, approve ? `Cancellation approved for ${o.number}` : `Cancellation declined for ${o.number}`, note || (approve ? "Your order has been cancelled." : "Your order will continue to be processed."), orderHref(orderId));
    return audit(next, adminId, `${approve ? "Approved" : "Declined"} cancellation for ${o.number}`, o.id);
  });
}

export function reviewReturn(orderId: string, approve: boolean, note: string, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o || o.returnRequest?.status !== "requested") return s;
    const actor = adminName(s, adminId);
    let next = updateOrder(s, orderId, (x) => {
      const returnRequest = { ...x.returnRequest!, status: approve ? ("approved" as const) : ("rejected" as const), decidedBy: actor, decidedAt: Date.now(), decisionNote: note };
      return withEvent({ ...x, returnRequest, status: approve ? "returned" : x.status }, approve ? `Return approved. ${note}` : `Return request rejected: ${note}`, actor);
    });
    next = notify(next, o.learnerId, approve ? `Return approved for ${o.number}` : `Return request rejected for ${o.number}`, note, orderHref(orderId));
    return audit(next, adminId, `${approve ? "Approved" : "Rejected"} return for ${o.number}`, o.id);
  });
}

export function sendReplacement(orderId: string, data: { courier: string; tracking: string }, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o || o.returnRequest?.status !== "approved") return s;
    const actor = adminName(s, adminId);
    let next = updateOrder(s, orderId, (x) =>
      withEvent({ ...x, returnRequest: { ...x.returnRequest!, replacement: { ...data, dispatchedAt: Date.now() } } }, `Replacement shipped via ${data.courier} — tracking ${data.tracking}.`, actor),
    );
    for (const i of o.items) next = moveStock(next, i.bookId, -i.qty, "replacement", `Replacement copy for ${o.number}`, actor, o.id);
    next = notify(next, o.learnerId, `Replacement shipped for ${o.number}`, `Tracking ${data.tracking} (${data.courier}).`, orderHref(orderId));
    return audit(next, adminId, `Sent replacement for ${o.number}`, o.id);
  });
}

export function recordRefund(orderId: string, refund: RefundInput, context: Refund["context"], adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o) return s;
    let next = addRefund(s, orderId, refund, context, adminId);
    next = notify(next, o.learnerId, `Refund update for ${o.number}`, `${formatINR(refund.amount)} refund ${refund.status === "completed" ? "sent" : "is being processed"} via ${refund.method === "upi" ? "UPI" : "bank transfer"}.`, orderHref(orderId));
    return audit(next, adminId, `Recorded ${formatINR(refund.amount)} refund for ${o.number}`, o.id);
  });
}

export function completeRefund(orderId: string, refundId: string, reference: string, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    const r = o?.refunds.find((x) => x.id === refundId);
    if (!o || !r) return s;
    const actor = adminName(s, adminId);
    let next = updateOrder(s, orderId, (x) => {
      const u: BookOrder = {
        ...x,
        refunds: x.refunds.map((f) => (f.id === refundId ? { ...f, status: "completed", reference: reference || f.reference, completedAt: Date.now() } : f)),
        status: r.context === "adjustment" ? x.status : "refunded",
      };
      return withEvent(u, `Refund of ${formatINR(r.amount)} completed (ref ${reference || r.reference}).`, actor);
    });
    next = notify(next, o.learnerId, `Refund completed for ${o.number}`, `${formatINR(r.amount)} sent via ${r.method === "upi" ? "UPI" : "bank transfer"}.`, orderHref(orderId));
    return audit(next, adminId, `Completed refund for ${o.number}`, o.id);
  });
}

export function resolveReturn(orderId: string, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o || o.returnRequest?.status !== "approved") return s;
    const next = updateOrder(s, orderId, (x) => withEvent({ ...x, returnRequest: { ...x.returnRequest!, status: "resolved", resolvedAt: Date.now() } }, "Return resolved.", adminName(s, adminId)));
    return audit(notify(next, o.learnerId, `Return resolved for ${o.number}`, "Thanks for your patience.", orderHref(orderId)), adminId, `Resolved return for ${o.number}`, o.id);
  });
}

/** Limited pre-dispatch edits. Totals are recalculated; paid orders get an explicit payment difference flag. */
export function editOrder(orderId: string, data: { items: { bookId: string; qty: number }[]; address: AddressSnapshot }, adminId: string): Result {
  const s = getState();
  const now = Date.now();
  const o = s.bookOrders.find((x) => x.id === orderId);
  if (!o) return { ok: false, error: "Order not found." };
  if (!["pending_payment", "payment_verification", "payment_rejected", "processing"].includes(o.status)) return { ok: false, error: "Orders can only be edited before dispatch." };
  const wanted = data.items.filter((i) => i.qty > 0);
  if (!wanted.length) return { ok: false, error: "An order needs at least one item. Cancel the order instead." };
  const paid = o.status === "processing";

  for (const w of wanted) {
    const before = o.items.find((i) => i.bookId === w.bookId)?.qty ?? 0;
    const delta = w.qty - before;
    if (delta <= 0) continue;
    const book = s.books.find((b) => b.id === w.bookId);
    if (!book) return { ok: false, error: "Book not found." };
    const free = paid ? book.stock : availableStock(book, s.bookOrders, now, o.id) - before;
    if (paid ? book.stock < delta : availableStock(book, s.bookOrders, now, o.id) < w.qty) {
      return { ok: false, error: `Only ${Math.max(0, free)} more of “${book.title}” available.` };
    }
  }

  const items: OrderItem[] = wanted.map((w) => {
    const existing = o.items.find((i) => i.bookId === w.bookId);
    if (existing) return { ...existing, qty: w.qty };
    const b = s.books.find((x) => x.id === w.bookId)!;
    return { bookId: b.id, title: b.title, author: b.author, isbn: b.isbn, edition: b.edition, language: b.language, theme: b.theme, qty: w.qty, unitPrice: b.price, mrp: b.mrp };
  });
  const t = totalsFor(items, s.bookstore);
  const changes: string[] = [];
  for (const i of items) {
    const before = o.items.find((x) => x.bookId === i.bookId)?.qty ?? 0;
    if (before !== i.qty) changes.push(before ? `“${i.title}” qty ${before} → ${i.qty}` : `added “${i.title}” × ${i.qty}`);
  }
  for (const i of o.items) if (!items.some((x) => x.bookId === i.bookId)) changes.push(`removed “${i.title}”`);
  const addressChanged = JSON.stringify(o.address) !== JSON.stringify(data.address);
  if (addressChanged) changes.push("delivery address updated");
  if (!changes.length) return { ok: false, error: "No changes to save." };

  setState((st) => {
    const actor = adminName(st, adminId);
    let next = updateOrder(st, orderId, (x) => {
      const diff = paid ? t.total - amountPaid(x) : 0;
      let u: BookOrder = { ...x, items, subtotal: t.subtotal, shipping: t.shipping, total: t.total, address: data.address, paymentDifference: paid ? diff || undefined : x.paymentDifference };
      u = withEvent(u, `Order edited by StudyVerse: ${changes.join("; ")}. New total ${formatINR(t.total)} (was ${formatINR(x.total)}).`, actor);
      if (paid && diff !== 0) {
        u = withEvent(u, diff > 0 ? `Payment difference: ${formatINR(diff)} additional amount due — to be collected manually.` : `Payment difference: ${formatINR(-diff)} to be refunded manually.`, actor);
      }
      return u;
    });
    if (paid) {
      for (const i of items) {
        const before = o.items.find((x) => x.bookId === i.bookId)?.qty ?? 0;
        if (i.qty !== before) next = moveStock(next, i.bookId, before - i.qty, i.qty > before ? "sale" : "restock", `Order ${o.number} edited`, actor, o.id);
      }
      for (const i of o.items) if (!items.some((x) => x.bookId === i.bookId)) next = moveStock(next, i.bookId, i.qty, "restock", `Order ${o.number} edited`, actor, o.id);
    }
    next = notify(next, o.learnerId, `Order ${o.number} was updated`, `${changes.join("; ")}. New total ${formatINR(t.total)}.`, orderHref(orderId));
    return audit(next, adminId, `Edited order ${o.number}: ${changes.join("; ")}`, o.id);
  });
  return { ok: true };
}

/** Records an extra manual payment collected for a positive payment difference */
export function settleAdditionalPayment(orderId: string, data: { method: PaymentMethod; reference: string; amount: number }, adminId: string) {
  setState((s) => {
    const o = s.bookOrders.find((x) => x.id === orderId);
    if (!o) return s;
    const actor = adminName(s, adminId);
    const next = updateOrder(s, orderId, (x) => {
      const remaining = (x.paymentDifference ?? 0) - data.amount;
      const u: BookOrder = {
        ...x,
        paymentDifference: remaining > 0 ? remaining : undefined,
        payments: [...x.payments, { id: uid("pay"), submittedAt: Date.now(), ...data, status: "approved", decidedBy: actor, decidedAt: Date.now() }],
      };
      return withEvent(u, `Additional payment of ${formatINR(data.amount)} verified (ref ${data.reference}).`, actor);
    });
    return audit(next, adminId, `Recorded additional payment for ${o.number}`, o.id);
  });
}

/* ---------------------------- Admin: books ---------------------------- */

export function createBook(data: Omit<Book, "id" | "createdAt" | "updatedAt" | "sold">, adminId: string): string {
  const id = uid("b");
  setState((s) => {
    const now = Date.now();
    let next: AppState = { ...s, books: [{ ...data, id, sold: 0, createdAt: now, updatedAt: now }, ...s.books] };
    if (data.stock > 0) {
      next = { ...next, stockMovements: [{ id: uid("mv"), bookId: id, at: now, delta: data.stock, kind: "added", reason: "Opening stock", actor: adminName(s, adminId) }, ...next.stockMovements] };
    }
    return audit(next, adminId, `Created book “${data.title}” (${data.status})`, id);
  });
  return id;
}

export function saveBook(book: Book, adminId: string) {
  setState((s) => {
    const prev = s.books.find((b) => b.id === book.id);
    if (!prev) return s;
    let next: AppState = { ...s, books: s.books.map((b) => (b.id === book.id ? { ...book, stock: prev.stock, updatedAt: Date.now() } : b)) };
    if (prev.price !== book.price || prev.mrp !== book.mrp) {
      next = audit(next, adminId, `Price changed: MRP ${formatINR(prev.mrp)} → ${formatINR(book.mrp)}, selling ${formatINR(prev.price)} → ${formatINR(book.price)} (applies to new orders only)`, book.id);
    }
    if (prev.photos.length !== book.photos.length || prev.primaryPhotoId !== book.primaryPhotoId || prev.photos.map((p) => p.id).join() !== book.photos.map((p) => p.id).join()) {
      next = audit(next, adminId, `Updated photo gallery (${book.photos.length} photos)`, book.id);
    }
    return audit(next, adminId, `Edited details of “${book.title}”`, book.id);
  });
}

export function setBookStatus(bookId: string, status: Book["status"], adminId: string) {
  setState((s) => {
    const b = s.books.find((x) => x.id === bookId);
    const verb = status === "published" ? "Published" : status === "archived" ? "Archived" : "Moved to draft";
    return audit({ ...s, books: s.books.map((x) => (x.id === bookId ? { ...x, status, updatedAt: Date.now() } : x)) }, adminId, `${verb} “${b?.title ?? ""}”`, bookId);
  });
}

export function adjustStock(bookId: string, delta: number, kind: "added" | "damaged" | "correction", reason: string, adminId: string) {
  setState((s) => {
    const b = s.books.find((x) => x.id === bookId);
    if (!b) return s;
    const next = moveStock(s, bookId, delta, kind, reason, adminName(s, adminId));
    return audit(next, adminId, `Stock ${delta >= 0 ? "+" : ""}${delta} for “${b.title}” (${kind}): ${reason}`, bookId);
  });
}

/* --------------------------- Admin: settings --------------------------- */

export function updateBookstoreSettings(settings: BookstoreSettings, adminId: string) {
  setState((s) => audit({ ...s, bookstore: settings }, adminId, "Updated bookstore settings"));
}

export function updateBookPermissions(targetId: string, perms: BookPermission[], ownerId: string) {
  setState((s) => {
    const t = s.admins.find((a) => a.id === targetId);
    if (!t || t.role === "owner") return s;
    return audit({ ...s, admins: s.admins.map((a) => (a.id === targetId ? { ...a, bookPermissions: perms } : a)) }, ownerId, `Updated bookstore permissions for ${t.name}`);
  });
}
