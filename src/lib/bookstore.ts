import type {
  Admin,
  Book,
  BookOrder,
  BookPermission,
  BookstoreSettings,
  CartItem,
  OrderItem,
  OrderStatus,
} from "./types";
import { DAY } from "./utils";

/* ------------------------------ Labels ------------------------------ */

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending Payment",
  payment_verification: "Payment Verification",
  payment_rejected: "Payment Rejected",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  refunded: "Refunded",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, "amber" | "sky" | "red" | "violet" | "brand" | "green" | "slate"> = {
  pending_payment: "amber",
  payment_verification: "sky",
  payment_rejected: "red",
  processing: "violet",
  shipped: "brand",
  delivered: "green",
  cancelled: "slate",
  returned: "slate",
  refunded: "slate",
};

export const BOOK_PERMISSION_LABEL: Record<BookPermission, string> = {
  "books.edit": "Add & edit books",
  "books.photos": "Manage product photos",
  "inventory.adjust": "Adjust inventory",
  "pricing.change": "Change prices",
  "payments.verify": "Verify payments",
  "orders.process": "Process orders",
  "dispatch.manage": "Manage dispatch",
  "cancellations.decide": "Approve/reject cancellations",
  "returns.review": "Review & approve returns",
  "refunds.record": "Record refunds",
  "reports.view": "View reports",
};

export const ALL_BOOK_PERMISSIONS = Object.keys(BOOK_PERMISSION_LABEL) as BookPermission[];

export const COURIERS = ["India Post (Speed Post)", "Delhivery", "DTDC", "Blue Dart", "Ekart", "Other courier"];

export const RETURN_REASON_LABEL = { damaged: "Damaged in transit", defective: "Printing/binding defect", incorrect: "Incorrect book received" } as const;

/* ---------------------------- Permissions ---------------------------- */

export function hasBookPermission(admin: Admin | undefined, perm: BookPermission): boolean {
  if (!admin) return false;
  return admin.role === "owner" || (admin.bookPermissions ?? []).includes(perm);
}

export function hasAnyBookPermission(admin: Admin | undefined, perms: BookPermission[] = ALL_BOOK_PERMISSIONS): boolean {
  return perms.some((p) => hasBookPermission(admin, p));
}

/* ----------------------------- Pricing ----------------------------- */

export function discountPercent(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function shippingFor(subtotal: number, settings: BookstoreSettings): number {
  if (subtotal <= 0) return 0;
  return subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
}

export function totalsFor(items: Pick<OrderItem, "qty" | "unitPrice" | "mrp">[], settings: BookstoreSettings) {
  const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
  const mrpTotal = items.reduce((a, i) => a + i.qty * i.mrp, 0);
  const shipping = shippingFor(subtotal, settings);
  return { subtotal, mrpTotal, savings: mrpTotal - subtotal, shipping, total: subtotal + shipping };
}

/* --------------------------- Reservations --------------------------- */

/**
 * - active:  unpaid order inside its reservation window (working assumption: clock starts at order creation)
 * - held:    payment submitted, awaiting admin verification — stock stays reserved, never auto-cancelled
 * - expired: window passed without a payment submission — stock released
 * - none:    paid, shipped or terminal (stock already committed or released)
 */
export type ReservationState = "active" | "held" | "expired" | "none";

export function reservationState(order: BookOrder, now: number): ReservationState {
  if (order.status === "payment_verification") return "held";
  if (order.status === "pending_payment" || order.status === "payment_rejected") {
    return now < order.reservationExpiresAt ? "active" : "expired";
  }
  return "none";
}

export function reservedQty(orders: BookOrder[], bookId: string, now: number, excludeOrderId?: string): number {
  return orders.reduce((sum, o) => {
    if (o.id === excludeOrderId) return sum;
    const st = reservationState(o, now);
    if (st !== "active" && st !== "held") return sum;
    return sum + o.items.filter((i) => i.bookId === bookId).reduce((a, i) => a + i.qty, 0);
  }, 0);
}

export function availableStock(book: Book, orders: BookOrder[], now: number, excludeOrderId?: string): number {
  return Math.max(0, book.stock - reservedQty(orders, book.id, now, excludeOrderId));
}

export type StockState = "in_stock" | "low" | "out";

export function stockState(available: number, settings: BookstoreSettings): StockState {
  if (available <= 0) return "out";
  if (available <= settings.lowStockThreshold) return "low";
  return "in_stock";
}

/* ------------------------------- Cart ------------------------------- */

export interface CartLine {
  item: CartItem;
  book: Book | undefined;
  available: number;
  /** Reason the line blocks checkout, if any */
  problem?: "unavailable" | "out_of_stock" | "insufficient";
}

export function cartLines(cart: CartItem[], books: Book[], orders: BookOrder[], now: number): CartLine[] {
  return cart.map((item) => {
    const book = books.find((b) => b.id === item.bookId);
    if (!book || book.status !== "published") return { item, book, available: 0, problem: "unavailable" };
    const available = availableStock(book, orders, now);
    if (available <= 0) return { item, book, available, problem: "out_of_stock" };
    if (item.qty > available) return { item, book, available, problem: "insufficient" };
    return { item, book, available };
  });
}

/* ------------------------------ Orders ------------------------------ */

export function amountPaid(order: BookOrder): number {
  return order.payments.filter((p) => p.status === "approved").reduce((a, p) => a + p.amount, 0);
}

export function latestPayment(order: BookOrder) {
  return [...order.payments].sort((a, b) => b.submittedAt - a.submittedAt)[0];
}

export function isPaid(order: BookOrder): boolean {
  return order.payments.some((p) => p.status === "approved");
}

export function canCustomerCancelDirectly(order: BookOrder): boolean {
  return order.status === "pending_payment" || order.status === "payment_rejected";
}

export function canRequestCancellation(order: BookOrder): boolean {
  return (order.status === "payment_verification" || order.status === "processing") && order.cancellation?.status !== "requested";
}

export function returnDeadline(order: BookOrder, settings: BookstoreSettings): number | undefined {
  return order.shipment?.deliveredAt ? order.shipment.deliveredAt + settings.returnWindowDays * DAY : undefined;
}

export function canRequestReturn(order: BookOrder, settings: BookstoreSettings, now: number): boolean {
  const deadline = returnDeadline(order, settings);
  return order.status === "delivered" && !order.returnRequest && !!deadline && now <= deadline;
}

export function isEditable(order: BookOrder): boolean {
  return ["pending_payment", "payment_verification", "payment_rejected", "processing"].includes(order.status);
}

/** Customer-facing progress steps */
export const ORDER_STEPS = ["Order placed", "Payment verification", "Payment confirmed", "Processing", "Shipped", "Delivered"] as const;

export function stepIndex(order: BookOrder): number {
  switch (order.status) {
    case "pending_payment":
      return 0;
    case "payment_verification":
    case "payment_rejected":
      return 1;
    case "processing":
      return 3;
    case "shipped":
      return 4;
    case "delivered":
    case "returned":
      return ORDER_STEPS.length; // every step complete
    case "refunded":
      return order.shipment?.deliveredAt ? ORDER_STEPS.length : order.payments.some((p) => p.status === "approved") ? 3 : 0;
    default:
      return 0;
  }
}

export function nextOrderNumber(orders: BookOrder[]): string {
  const max = orders.reduce((m, o) => Math.max(m, Number(o.number.replace(/\D/g, "")) || 0), 10200);
  return `SVB-${max + 1}`;
}

/**
 * Static storefront routes that sit beside `/books/[slug]` (src/app/(site)/books/*).
 * A book with one of these slugs would be unreachable, so the editor rejects them.
 */
export const RESERVED_BOOK_SLUGS = ["cart", "catalog", "checkout", "orders"] as const;

export function isReservedBookSlug(slug: string): boolean {
  return (RESERVED_BOOK_SLUGS as readonly string[]).includes(slug);
}

export function isValidPin(pin: string): boolean {
  return /^[1-9]\d{5}$/.test(pin.trim());
}

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
