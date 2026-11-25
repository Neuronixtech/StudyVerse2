import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addToCart,
  adjustStock,
  approveBookPayment,
  cancelOrderByCustomer,
  dispatchOrder,
  markDelivered,
  placeOrder,
  recordRefund,
  rejectBookPayment,
  removeFromCart,
  requestCancellation,
  requestReturn,
  reviewReturn,
  saveAddress,
  setBookStatus,
  setCartQty,
  submitBookPayment,
} from "./bookstore-store";
import { getState } from "./store";
import type { AppState } from "./mock/seed";
import { makeBook, makeOrder } from "@/test/fixtures/bookstore";
import { createTestState } from "@/test/fixtures/state";
import { FIXED_NOW, HOUR } from "@/test/fixtures/time";
import { ADMINS, LEARNERS } from "@/test/fixtures/users";
import { seedStore } from "@/test/render";

const ME = LEARNERS.learnerNoSubscription;
const order = (id: string) => getState().bookOrders.find((o) => o.id === id)!;
const book = (id: string) => getState().books.find((b) => b.id === id)!;

/** Two controlled books, an address for ME and an empty order book. */
function seed(mutate?: (s: AppState) => void) {
  return seedStore(
    createTestState({ learner: "learnerNoSubscription" }, (s) => {
      s.books = [makeBook("b-a", { price: 400, mrp: 500, stock: 5 }), makeBook("b-b", { price: 169, mrp: 199, stock: 2 })];
      s.bookOrders = [];
      s.carts = {};
      s.addresses = [{ id: "ad-1", learnerId: ME, fullName: "Aarav Mehta", mobile: "9822011223", line1: "12 Lake Road", locality: "Kothrud", city: "Pune", state: "Maharashtra", pin: "411038", isDefault: true }];
      mutate?.(s);
    }),
  );
}

beforeEach(() => {
  vi.setSystemTime(FIXED_NOW);
  seed();
});

describe("cart", () => {
  it("BOOK-005 — adding the same book twice increments one line", () => {
    addToCart("guest", "b-a");
    addToCart("guest", "b-a", 2);
    expect(getState().carts.guest).toEqual([{ bookId: "b-a", qty: 3, addedAt: FIXED_NOW }]);
  });

  it("BOOK-006 — quantity never drops below 1, and removal deletes the line", () => {
    addToCart(ME, "b-a");
    setCartQty(ME, "b-a", 0);
    expect(getState().carts[ME][0].qty).toBe(1);
    setCartQty(ME, "b-a", 4);
    expect(getState().carts[ME][0].qty).toBe(4);
    removeFromCart(ME, "b-a");
    expect(getState().carts[ME]).toEqual([]);
  });
});

describe("checkout", () => {
  it("BOOK-010 — places a multi-book order with a price snapshot, totals and a reservation", () => {
    addToCart(ME, "b-a", 2);
    addToCart(ME, "b-b", 1);
    const res = placeOrder(ME, "ad-1");
    expect(res.ok).toBe(true);
    const placed = order((res as { id: string }).id);

    expect(placed.items.map((i) => [i.bookId, i.qty, i.unitPrice])).toEqual([
      ["b-a", 2, 400],
      ["b-b", 1, 169],
    ]);
    expect(placed).toMatchObject({ subtotal: 969, shipping: 49, total: 1018, status: "pending_payment", reservationExpiresAt: FIXED_NOW + 24 * HOUR });
    expect(placed.address).toMatchObject({ city: "Pune", pin: "411038" });
    expect(getState().carts[ME]).toEqual([]);
  });

  it("BOOK-011 — refuses to place an order that exceeds stock and keeps the cart", () => {
    addToCart(ME, "b-b", 3);
    expect(placeOrder(ME, "ad-1")).toEqual({ ok: false, error: expect.stringMatching(/exceed available stock/) });
    expect(getState().bookOrders).toHaveLength(0);
    expect(getState().carts[ME]).toEqual([{ bookId: "b-b", qty: 3, addedAt: FIXED_NOW }]);
  });

  it("requires an address that belongs to the learner, and a non-empty cart", () => {
    expect(placeOrder(ME, "ad-1")).toEqual({ ok: false, error: "Your cart is empty." });
    addToCart(ME, "b-a");
    expect(placeOrder(ME, "someone-elses-address")).toEqual({ ok: false, error: "Choose a delivery address." });
  });

  it("saving the first address makes it the default", () => {
    seed((s) => (s.addresses = []));
    const id = saveAddress(ME, { fullName: "A", mobile: "9876543210", line1: "1 Road", locality: "X", city: "Pune", state: "Maharashtra", pin: "411001", isDefault: false });
    expect(getState().addresses.find((a) => a.id === id)?.isDefault).toBe(true);
  });
});

describe("payment workflow (simulated, manual verification)", () => {
  beforeEach(() => {
    seed((s) => (s.bookOrders = [makeOrder("o-1", s.books[0], 2, { learnerId: ME })]));
  });

  it("BOOK-013 — submitting payment details moves the order to verification, not confirmed", () => {
    expect(submitBookPayment("o-1", { method: "upi", reference: "402188761123", amount: 800 })).toEqual({ ok: true });
    const o = order("o-1");
    expect(o.status).toBe("payment_verification");
    expect(o.payments).toEqual([expect.objectContaining({ status: "submitted", reference: "402188761123", amount: 800 })]);
    expect(o.events.at(-1)?.text).toMatch(/Awaiting verification/);
  });

  it("refuses a second submission while one is being verified", () => {
    submitBookPayment("o-1", { method: "upi", reference: "402188761123", amount: 800 });
    expect(submitBookPayment("o-1", { method: "upi", reference: "999999999999", amount: 800 })).toEqual({ ok: false, error: "This order isn't awaiting payment." });
  });

  it("BOOKADM-006 — approval confirms payment, moves to Processing and deducts stock", () => {
    submitBookPayment("o-1", { method: "upi", reference: "402188761123", amount: 800 });
    approveBookPayment("o-1", order("o-1").payments[0].id, ADMINS.owner);
    expect(order("o-1").status).toBe("processing");
    expect(order("o-1").payments[0].status).toBe("approved");
    expect(book("b-a")).toMatchObject({ stock: 3, sold: 2 });
  });

  it("BOOKADM-006 — rejection records the reason and allows resubmission", () => {
    submitBookPayment("o-1", { method: "upi", reference: "402188761123", amount: 800 });
    rejectBookPayment("o-1", order("o-1").payments[0].id, "Amount not received.", ADMINS.owner);
    expect(order("o-1")).toMatchObject({ status: "payment_rejected", payments: [expect.objectContaining({ status: "rejected", rejectionReason: "Amount not received." })] });
    expect(submitBookPayment("o-1", { method: "bank", reference: "NEFT-123456", amount: 800 })).toEqual({ ok: true });
  });

  it("cancelling before payment releases the reservation without a refund", () => {
    cancelOrderByCustomer("o-1", "Ordered by mistake");
    expect(order("o-1")).toMatchObject({ status: "cancelled", refunds: [] });
  });
});

describe("fulfilment, cancellation and returns", () => {
  const paidOrder = (s: AppState) => {
    const o = makeOrder("o-2", s.books[0], 1, { learnerId: ME, status: "processing" });
    o.payments = [{ id: "pay-1", submittedAt: FIXED_NOW - HOUR, method: "upi", reference: "402188761123", amount: o.total, status: "approved" }];
    return o;
  };

  beforeEach(() => {
    seed((s) => (s.bookOrders = [paidOrder(s)]));
  });

  it("BOOKADM-007 — dispatch then delivery update the customer timeline", () => {
    dispatchOrder("o-2", { mode: "courier", courier: "DTDC", tracking: "D123456" }, ADMINS.owner);
    expect(order("o-2")).toMatchObject({ status: "shipped", shipment: { courier: "DTDC", tracking: "D123456", dispatchedAt: FIXED_NOW } });
    markDelivered("o-2", ADMINS.owner);
    expect(order("o-2")).toMatchObject({ status: "delivered", shipment: { deliveredAt: FIXED_NOW } });
    expect(order("o-2").events.filter((e) => e.customerVisible).map((e) => e.text)).toEqual(["Shipped via DTDC — tracking D123456.", "Delivered."]);
  });

  it("an order on hold cannot be dispatched", () => {
    seed((s) => (s.bookOrders = [{ ...paidOrder(s), hold: { reason: "Restock", at: FIXED_NOW, by: "System" } }]));
    dispatchOrder("o-2", { mode: "courier", courier: "DTDC", tracking: "D1" }, ADMINS.owner);
    expect(order("o-2").status).toBe("processing");
  });

  it("BOOK-015 — a cancellation request is recorded without marking the order refunded", () => {
    requestCancellation("o-2", "Bought elsewhere");
    expect(order("o-2")).toMatchObject({ status: "processing", cancellation: { status: "requested", reason: "Bought elsewhere" }, refunds: [] });
  });

  it("BOOK-016 / BOOKADM-008 — a return goes to review, then approval and a recorded (mock) refund", () => {
    dispatchOrder("o-2", { mode: "courier", courier: "DTDC", tracking: "D1" }, ADMINS.owner);
    markDelivered("o-2", ADMINS.owner);
    requestReturn("o-2", { reason: "damaged", details: "Cover torn", photos: ["torn.jpg"], preference: "refund" });
    expect(order("o-2").returnRequest).toMatchObject({ status: "requested", reason: "damaged" });

    reviewReturn("o-2", true, "Sorry about that.", ADMINS.owner);
    expect(order("o-2")).toMatchObject({ status: "returned", returnRequest: { status: "approved" } });

    recordRefund("o-2", { amount: 400, method: "upi", reference: "RF-1", status: "completed" }, "return", ADMINS.owner);
    expect(order("o-2")).toMatchObject({ status: "refunded", refunds: [expect.objectContaining({ amount: 400, reference: "RF-1", status: "completed" })] });
  });
});

describe("inventory administration", () => {
  it("BOOKADM-005 — a stock adjustment updates stock and logs the reason", () => {
    adjustStock("b-a", -2, "damaged", "Water damage in storage", ADMINS.owner);
    expect(book("b-a").stock).toBe(3);
    expect(getState().stockMovements[0]).toMatchObject({ bookId: "b-a", delta: -2, kind: "damaged", reason: "Water damage in storage" });
  });

  it("stock never goes below zero", () => {
    adjustStock("b-b", -10, "correction", "Recount", ADMINS.owner);
    expect(book("b-b").stock).toBe(0);
  });

  it("BOOKADM-004 — lifecycle status changes are audited", () => {
    setBookStatus("b-a", "archived", ADMINS.owner);
    expect(book("b-a").status).toBe("archived");
    expect(getState().audit[0]).toMatchObject({ text: "Archived “Book b-a”", ref: "b-a" });
  });
});
