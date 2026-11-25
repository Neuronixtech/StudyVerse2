import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookCard } from "@/components/bookstore/book-card";
import type { AppState } from "@/lib/mock/seed";
import { getState } from "@/lib/store";
import type { CartItem } from "@/lib/types";
import { makeBook, makeOrder } from "@/test/fixtures/bookstore";
import { createTestState, type TestStateOptions } from "@/test/fixtures/state";
import { FIXED_NOW, HOUR } from "@/test/fixtures/time";
import { LEARNERS } from "@/test/fixtures/users";
import { router } from "@/test/mocks/next-navigation";
import { renderWithStore } from "@/test/render";
import { AddressForm, CartPage, CheckoutPage } from "./cart-checkout";
import { OrderPayment } from "./payment";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const ME = LEARNERS.learnerNoSubscription;
const BOOKS = () => [makeBook("b-a", { title: "Physics Workbook", price: 400, mrp: 500, stock: 5 }), makeBook("b-b", { title: "Formula Handbook", price: 169, mrp: 199, stock: 2 })];

function storeWith(session: TestStateOptions, cart: CartItem[] = [], mutate?: (s: AppState) => void) {
  return createTestState(session, (s) => {
    s.books = BOOKS();
    s.bookOrders = [];
    const key = session.learner ? LEARNERS[session.learner] : "guest";
    s.carts = { [key]: cart };
    mutate?.(s);
  });
}

const line = (bookId: string, qty: number): CartItem => ({ bookId, qty, addedAt: FIXED_NOW });
const totals = () => {
  const dl = screen.getByText("Total payable").closest("dl")!;
  return Object.fromEntries(within(dl).getAllByRole("term").map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]));
};

beforeEach(() => vi.setSystemTime(FIXED_NOW));

describe("BookCard", () => {
  it("BOOK-005 — a visitor can add an in-stock book to the guest cart", async () => {
    const state = storeWith({});
    const { user } = renderWithStore(<BookCard book={state.books[0]} />, { state });
    await user.click(screen.getByRole("button", { name: "Add to cart: Physics Workbook" }));

    expect(getState().carts.guest).toEqual([line("b-a", 1)]);
    expect(screen.getByRole("button", { name: /^In cart \(1\) · Add another:\s*Physics Workbook$/ })).toBeInTheDocument();
    expect(screen.getByText("Added to cart")).toBeInTheDocument();
  });

  it("an out-of-stock book cannot be added", () => {
    const state = storeWith({}, [], (s) => (s.books[0].stock = 0));
    renderWithStore(<BookCard book={state.books[0]} />, { state });
    expect(screen.getByRole("button", { name: /^Out of stock:\s*Physics Workbook$/ })).toBeDisabled();
  });
});

describe("CartPage", () => {
  it("BOOK-010 — shows line items and correct subtotal, savings, shipping and total", () => {
    renderWithStore(<CartPage />, { state: storeWith({ learner: "learnerNoSubscription" }, [line("b-a", 2), line("b-b", 1)]) });
    expect(totals()).toEqual({ "Item subtotal": "₹969", "You save (vs MRP)": "−₹230", Shipping: "₹49", "Total payable": "₹1,018" });
    expect(screen.getByText("Add ₹30 more for free shipping.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Proceed to checkout/ })).toHaveAttribute("href", "/books/checkout");
  });

  it("BOOK-006 — quantity controls and removal update the cart and totals", async () => {
    const { user } = renderWithStore(<CartPage />, { state: storeWith({ learner: "learnerNoSubscription" }, [line("b-a", 1)]) });
    const qty = screen.getByRole("group", { name: "Quantity for Physics Workbook" });
    expect(within(qty).getByRole("button", { name: "Decrease quantity" })).toBeDisabled();

    await user.click(within(qty).getByRole("button", { name: "Increase quantity" }));
    await user.click(within(qty).getByRole("button", { name: "Increase quantity" }));
    expect(qty).toHaveTextContent("3");
    expect(totals()["Item subtotal"]).toBe("₹1,200");
    expect(totals().Shipping).toBe("Free");

    await user.click(screen.getByRole("button", { name: /Remove/ }));
    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
    expect(getState().carts[ME]).toEqual([]);
  });

  it("caps the quantity at the available stock", async () => {
    const { user } = renderWithStore(<CartPage />, { state: storeWith({ learner: "learnerNoSubscription" }, [line("b-b", 1)]) });
    const qty = screen.getByRole("group", { name: "Quantity for Formula Handbook" });
    await user.click(within(qty).getByRole("button", { name: "Increase quantity" }));
    expect(within(qty).getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  it("BOOK-011 — a quantity above stock is flagged, kept in the cart, and blocks checkout", () => {
    renderWithStore(<CartPage />, { state: storeWith({ learner: "learnerNoSubscription" }, [line("b-b", 3)]) });
    expect(screen.getByRole("alert")).toHaveTextContent("Only 2 available. Reduce the quantity to continue.");
    expect(screen.getByText(/we never remove items for you/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Proceed to checkout/ })).toHaveAttribute("aria-disabled", "true");
    expect(getState().carts[ME]).toEqual([line("b-b", 3)]);
  });

  it("BOOK-008 — a guest is sent to log in, with the cart kept", () => {
    renderWithStore(<CartPage />, { state: storeWith({}, [line("b-a", 1)]) });
    expect(screen.getByText(/You can shop as a guest/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Log in to checkout/ })).toHaveAttribute("href", "/login?next=/books/checkout");
    expect(screen.getByText("Your cart is saved while you log in or sign up.")).toBeInTheDocument();
  });

  it("STATE-002 — an empty cart has a helpful empty state", () => {
    renderWithStore(<CartPage />, { state: storeWith({}) });
    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Visit the bookstore" })).toHaveAttribute("href", "/books");
  });
});

describe("CheckoutPage", () => {
  it("BOOK-008 — checkout requires login and places no order", () => {
    renderWithStore(<CheckoutPage />, { state: storeWith({}, [line("b-a", 1)]) });
    expect(screen.getByRole("heading", { name: "Log in to check out" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place order/ })).not.toBeInTheDocument();
    expect(getState().bookOrders).toHaveLength(0);
  });

  it("SUB-012 — a learner without a learning subscription can check out", () => {
    renderWithStore(<CheckoutPage />, { state: storeWith({ learner: "learnerNoSubscription" }, [line("b-a", 1)]) });
    expect(screen.getByRole("heading", { name: "Checkout" })).toBeInTheDocument();
    expect(screen.queryByText(/Subscribe to unlock/)).not.toBeInTheDocument();
  });

  it("BOOK-009 — the first address must be valid before the order can be placed", async () => {
    const { user } = renderWithStore(<CheckoutPage />, {
      state: storeWith({ learner: "learnerNoSubscription" }, [line("b-a", 1)], (s) => (s.addresses = s.addresses.filter((a) => a.learnerId !== ME))),
    });
    expect(screen.getByRole("button", { name: /Place order/ })).toBeDisabled();
    // name and mobile are prefilled from the profile
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Aarav Mehta");

    await user.type(screen.getByLabelText(/PIN code/), "01103");
    await user.click(screen.getByRole("button", { name: "Save and use this address" }));
    expect(screen.getByLabelText(/PIN code/)).toHaveAccessibleDescription("Enter a valid 6-digit PIN code");
    expect(screen.getByLabelText(/^State/)).toHaveAccessibleDescription("Choose a state");
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Aarav Mehta"); // STATE-005
  });

  it("BOOK-010 / BOOK-012 — placing the order reserves stock and opens payment", async () => {
    const { user } = renderWithStore(<CheckoutPage />, {
      state: storeWith({ learner: "learnerNoSubscription" }, [line("b-a", 2), line("b-b", 1)], (s) => {
        s.addresses = [{ id: "ad-1", learnerId: ME, fullName: "Aarav Mehta", mobile: "9822011223", line1: "12 Lake Road", locality: "Kothrud", city: "Pune", state: "Maharashtra", pin: "411038", isDefault: true }];
      }),
    });
    expect(totals()["Total payable"]).toBe("₹1,018");
    await user.click(screen.getByRole("button", { name: "Place order · ₹1,018" }));
    const dialog = screen.getByRole("dialog", { name: "Place order for ₹1,018?" });
    expect(within(dialog).getByText(/reserved for 24 hours/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Place order" }));

    const order = getState().bookOrders[0];
    expect(order).toMatchObject({ learnerId: ME, total: 1018, status: "pending_payment" });
    expect(router.push).toHaveBeenCalledWith(`/books/orders/${order.id}/payment`);
  });

  it("BOOK-011 — checkout is blocked while a line exceeds stock", () => {
    renderWithStore(<CheckoutPage />, { state: storeWith({ learner: "learnerNoSubscription" }, [line("b-b", 3)]) });
    expect(screen.getByRole("button", { name: /Place order/ })).toBeDisabled();
    expect(screen.getByText("Only 2 available")).toBeInTheDocument();
  });
});

describe("AddressForm", () => {
  it("BOOK-009 — validates mobile and PIN formats and strips non-digits from the PIN", async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithStore(<AddressForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Mobile number/), "12345");
    await user.type(screen.getByLabelText(/PIN code/), "41a10b38");
    expect(screen.getByLabelText(/PIN code/)).toHaveValue("411038");
    await user.click(screen.getByRole("button", { name: "Save address" }));

    expect(screen.getByLabelText(/Mobile number/)).toHaveAccessibleDescription("Enter a valid 10-digit mobile number");
    expect(screen.getByLabelText(/PIN code/)).not.toHaveAttribute("aria-invalid");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("OrderPayment", () => {
  const withOrder = (status: "pending_payment" | "payment_verification" = "pending_payment") =>
    storeWith({ learner: "learnerNoSubscription" }, [], (s) => {
      const o = makeOrder("o-1", s.books[0], 2, { learnerId: ME, status, reservationExpiresAt: FIXED_NOW + 23 * HOUR });
      if (status === "payment_verification") o.payments = [{ id: "p1", submittedAt: FIXED_NOW, method: "upi", reference: "402188761123", amount: 800, status: "submitted" }];
      s.bookOrders = [o];
    });

  it("BOOK-012 — shows the amount and demo UPI/bank instructions, clearly simulated", async () => {
    const { user } = renderWithStore(<OrderPayment orderId="o-1" />, { state: withOrder() });
    expect(screen.getByRole("heading", { name: "Complete your payment" })).toBeInTheDocument();
    expect(screen.getByText("Amount to pay").nextElementSibling).toHaveTextContent("₹800");
    expect(screen.getByText("studyverse.books@upi")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Demo QR code (not payable)" })).toBeInTheDocument();

    await user.click(within(screen.getByRole("radiogroup", { name: "Payment option" })).getByRole("radio", { name: /Bank transfer/ }));
    expect(screen.getByText("DEMO0004321")).toBeInTheDocument();
  });

  it("BOOK-013 — submitting details moves the order to Payment Verification, not paid", async () => {
    const { user } = renderWithStore(<OrderPayment orderId="o-1" />, { state: withOrder() });
    await user.type(screen.getByLabelText(/UPI transaction ID/), "402188761123");
    await user.click(screen.getByRole("button", { name: "Submit payment details" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/doesn't mark the order paid/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Submit" }));

    expect(getState().bookOrders[0].status).toBe("payment_verification");
    expect(screen.getByRole("heading", { name: /we're verifying your payment/ })).toBeInTheDocument();
  });

  it("rejects a malformed UPI reference", async () => {
    const { user } = renderWithStore(<OrderPayment orderId="o-1" />, { state: withOrder() });
    await user.type(screen.getByLabelText(/UPI transaction ID/), "1234");
    await user.click(screen.getByRole("button", { name: "Submit payment details" }));
    expect(screen.getByLabelText(/UPI transaction ID/)).toHaveAccessibleDescription("UPI transaction IDs (UTR) are 12 digits");
    expect(getState().bookOrders[0].status).toBe("pending_payment");
  });

  it("another learner cannot open the order", () => {
    const state = withOrder();
    state.session.learnerId = LEARNERS.learnerActive;
    renderWithStore(<OrderPayment orderId="o-1" />, { state });
    expect(screen.getByText("Order not found")).toBeInTheDocument();
  });
});
