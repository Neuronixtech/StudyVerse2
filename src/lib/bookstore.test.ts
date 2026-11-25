import { describe, expect, it } from "vitest";
import {
  availableStock,
  canCustomerCancelDirectly,
  canRequestCancellation,
  canRequestReturn,
  cartLines,
  discountPercent,
  hasAnyBookPermission,
  hasBookPermission,
  isEditable,
  isReservedBookSlug,
  isValidPin,
  nextOrderNumber,
  reservationState,
  reservedQty,
  returnDeadline,
  shippingFor,
  stepIndex,
  stockState,
  totalsFor,
} from "./bookstore";
import type { Admin, BookOrder, OrderStatus } from "./types";
import { makeBook, makeOrder, settings } from "@/test/fixtures/bookstore";
import { createTestState } from "@/test/fixtures/state";
import { DAY, FIXED_NOW, HOUR } from "@/test/fixtures/time";
import { ADMINS } from "@/test/fixtures/users";

const s = settings({ shippingFee: 49, freeShippingThreshold: 999, lowStockThreshold: 5, returnWindowDays: 7 });

describe("pricing", () => {
  it("rounds the discount and never reports one when price ≥ MRP", () => {
    expect(discountPercent(650, 520)).toBe(20);
    expect(discountPercent(595, 499)).toBe(16);
    expect(discountPercent(450, 450)).toBe(0);
    expect(discountPercent(400, 450)).toBe(0);
    expect(discountPercent(0, 100)).toBe(0);
  });

  it("charges shipping below the free-shipping threshold only", () => {
    expect(shippingFor(0, s)).toBe(0);
    expect(shippingFor(998, s)).toBe(49);
    expect(shippingFor(999, s)).toBe(0);
  });

  it("BOOK-010 — totals a multi-book order with quantities, savings and shipping", () => {
    const totals = totalsFor(
      [
        { qty: 2, unitPrice: 400, mrp: 500 },
        { qty: 1, unitPrice: 169, mrp: 199 },
      ],
      s,
    );
    expect(totals).toEqual({ subtotal: 969, mrpTotal: 1199, savings: 230, shipping: 49, total: 1018 });
  });

  it("BOOK-010 — crossing the threshold removes shipping", () => {
    expect(totalsFor([{ qty: 3, unitPrice: 400, mrp: 500 }], s)).toMatchObject({ subtotal: 1200, shipping: 0, total: 1200 });
  });
});

describe("reservations and available stock", () => {
  const book = makeBook("b1", { stock: 5 });

  it.each<[OrderStatus, string, string, number]>([
    ["pending_payment", "inside the window", "active", FIXED_NOW + HOUR],
    ["pending_payment", "past the window", "expired", FIXED_NOW - 1],
    ["payment_rejected", "inside the window", "active", FIXED_NOW + HOUR],
    ["payment_verification", "past the window", "held", FIXED_NOW - DAY],
    ["processing", "inside the window", "none", FIXED_NOW + HOUR],
    ["cancelled", "inside the window", "none", FIXED_NOW + HOUR],
  ])("%s %s → %s", (status, _when, expected, reservationExpiresAt) => {
    expect(reservationState(makeOrder("o", book, 1, { status, reservationExpiresAt }), FIXED_NOW)).toBe(expected);
  });

  it("subtracts active and held reservations from stock", () => {
    const orders = [
      makeOrder("o1", book, 2),
      makeOrder("o2", book, 1, { status: "payment_verification", reservationExpiresAt: FIXED_NOW - DAY }),
      makeOrder("o3", book, 1, { reservationExpiresAt: FIXED_NOW - 1 }), // expired → released
      makeOrder("o4", book, 1, { status: "processing" }), // already deducted from stock on payment
    ];
    expect(reservedQty(orders, "b1", FIXED_NOW)).toBe(3);
    expect(availableStock(book, orders, FIXED_NOW)).toBe(2);
    expect(availableStock(book, orders, FIXED_NOW, "o1")).toBe(4);
  });

  it("never reports negative availability", () => {
    expect(availableStock(makeBook("b", { stock: 1 }), [makeOrder("o", makeBook("b"), 3)], FIXED_NOW)).toBe(0);
  });

  it("classifies stock as in stock, low or out using the threshold", () => {
    expect(stockState(0, s)).toBe("out");
    expect(stockState(5, s)).toBe("low");
    expect(stockState(6, s)).toBe("in_stock");
  });
});

describe("BOOK-011 — cartLines blocks checkout for unavailable quantities", () => {
  const books = [
    makeBook("ok", { stock: 10 }),
    makeBook("short", { stock: 2 }),
    makeBook("none", { stock: 0 }),
    makeBook("draft", { status: "draft" }),
    makeBook("archived", { status: "archived" }),
  ];
  const cart = (bookId: string, qty: number) => [{ bookId, qty, addedAt: FIXED_NOW }];

  it("an in-stock quantity has no problem", () => {
    const [line] = cartLines(cart("ok", 3), books, [], FIXED_NOW);
    expect(line.available).toBe(10);
    expect(line.problem).toBeUndefined();
  });

  it("asking for more than available is 'insufficient' and keeps the line", () => {
    const [line] = cartLines(cart("short", 3), books, [], FIXED_NOW);
    expect(line).toMatchObject({ available: 2, problem: "insufficient" });
    expect(line.item.qty).toBe(3);
  });

  it("zero stock is 'out_of_stock'", () => {
    expect(cartLines(cart("none", 1), books, [], FIXED_NOW)[0].problem).toBe("out_of_stock");
  });

  it("other customers' reservations count against availability", () => {
    expect(cartLines(cart("short", 1), books, [makeOrder("o", books[1], 2)], FIXED_NOW)[0].problem).toBe("out_of_stock");
  });

  it.each(["draft", "archived", "deleted"])("a %s book is 'unavailable'", (id) => {
    expect(cartLines(cart(id, 1), books, [], FIXED_NOW)[0].problem).toBe("unavailable");
  });
});

describe("order lifecycle rules", () => {
  const book = makeBook("b");
  const order = (status: OrderStatus, extra: Partial<BookOrder> = {}) => makeOrder("o", book, 1, { status, ...extra });

  it("customers can cancel directly only before paying", () => {
    expect(canCustomerCancelDirectly(order("pending_payment"))).toBe(true);
    expect(canCustomerCancelDirectly(order("payment_rejected"))).toBe(true);
    expect(canCustomerCancelDirectly(order("payment_verification"))).toBe(false);
    expect(canCustomerCancelDirectly(order("processing"))).toBe(false);
  });

  it("BOOK-015 — after paying, customers request cancellation (once) until shipment", () => {
    expect(canRequestCancellation(order("payment_verification"))).toBe(true);
    expect(canRequestCancellation(order("processing"))).toBe(true);
    expect(canRequestCancellation(order("processing", { cancellation: { requestedAt: FIXED_NOW, reason: "x", status: "requested" } }))).toBe(false);
    expect(canRequestCancellation(order("shipped"))).toBe(false);
  });

  describe("BOOK-016 — return window", () => {
    const deliveredAt = FIXED_NOW - 3 * DAY;
    const delivered = order("delivered", { shipment: { mode: "courier", courier: "DTDC", tracking: "T1", dispatchedAt: deliveredAt - DAY, deliveredAt } });

    it("the deadline is the delivery date plus the configured window", () => {
      expect(returnDeadline(delivered, s)).toBe(deliveredAt + 7 * DAY);
      expect(returnDeadline(order("shipped"), s)).toBeUndefined();
    });

    it("allows a return inside the window, including the last moment", () => {
      expect(canRequestReturn(delivered, s, FIXED_NOW)).toBe(true);
      expect(canRequestReturn(delivered, s, deliveredAt + 7 * DAY)).toBe(true);
    });

    it("refuses a return after the window, twice, or before delivery", () => {
      expect(canRequestReturn(delivered, s, deliveredAt + 7 * DAY + 1)).toBe(false);
      expect(canRequestReturn({ ...delivered, returnRequest: { requestedAt: FIXED_NOW, reason: "damaged", details: "", photos: [], preference: "refund", status: "requested" } }, s, FIXED_NOW)).toBe(false);
      expect(canRequestReturn(order("shipped"), s, FIXED_NOW)).toBe(false);
    });
  });

  it("orders are editable only before dispatch", () => {
    expect(isEditable(order("processing"))).toBe(true);
    expect(isEditable(order("shipped"))).toBe(false);
  });

  it("BOOK-014 — maps statuses onto customer-facing timeline steps", () => {
    expect(stepIndex(order("pending_payment"))).toBe(0);
    expect(stepIndex(order("payment_verification"))).toBe(1);
    expect(stepIndex(order("payment_rejected"))).toBe(1);
    expect(stepIndex(order("processing"))).toBe(3);
    expect(stepIndex(order("shipped"))).toBe(4);
    expect(stepIndex(order("delivered"))).toBe(6);
  });

  it("allocates the next sequential order number", () => {
    expect(nextOrderNumber([])).toBe("SVB-10201");
    expect(nextOrderNumber([order("pending_payment", { number: "SVB-10234" })])).toBe("SVB-10235");
  });
});

describe("BOOK-009 — PIN code validation", () => {
  it.each(["411038", " 110001 "])("accepts %j", (pin) => expect(isValidPin(pin)).toBe(true));
  it.each(["011038", "41103", "4110388", "41103a", ""])("rejects %j", (pin) => expect(isValidPin(pin)).toBe(false));
});

describe("BOOKADM-009 — bookstore permissions", () => {
  const { admins } = createTestState();
  const admin = (id: string) => admins.find((a) => a.id === id) as Admin;

  it("the owner has every bookstore permission", () => {
    expect(hasBookPermission(admin(ADMINS.owner), "payments.verify")).toBe(true);
    expect(hasBookPermission(admin(ADMINS.owner), "refunds.record")).toBe(true);
  });

  it("staff only have the permissions assigned to them", () => {
    const priya = admin(ADMINS.staffCourseManager);
    expect(hasBookPermission(priya, "dispatch.manage")).toBe(true);
    expect(hasBookPermission(priya, "payments.verify")).toBe(false);
    const arjun = admin(ADMINS.staffLimited);
    expect(hasBookPermission(arjun, "payments.verify")).toBe(true);
    expect(hasBookPermission(arjun, "dispatch.manage")).toBe(false);
  });

  it("hasAnyBookPermission checks a set", () => {
    expect(hasAnyBookPermission(admin(ADMINS.staffLimited), ["books.edit", "inventory.adjust"])).toBe(false);
    expect(hasAnyBookPermission(admin(ADMINS.staffLimited), ["books.edit", "returns.review"])).toBe(true);
    expect(hasAnyBookPermission(undefined)).toBe(false);
  });
});

describe("route safety — reserved storefront slugs", () => {
  it("flags slugs that collide with static /books/* routes", () => {
    for (const slug of ["cart", "catalog", "checkout", "orders"]) expect(isReservedBookSlug(slug)).toBe(true);
    expect(isReservedBookSlug("calculus-workbook")).toBe(false);
  });

  it("no seeded book uses a reserved slug", () => {
    expect(createTestState().books.filter((b) => isReservedBookSlug(b.slug))).toEqual([]);
  });
});
