import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getState } from "@/lib/store";
import { createTestState } from "@/test/fixtures/state";
import { FIXED_NOW } from "@/test/fixtures/time";
import { renderWithStore } from "@/test/render";
import { OrderDetailView } from "./my-orders";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const order = (id: string) => getState().bookOrders.find((o) => o.id === id)!;
/** The <ol> rendered inside the "Order timeline" card. */
const timelineList = () => {
  let el: HTMLElement | null = screen.getByText("Order timeline");
  while (el && !el.querySelector("ol")) el = el.parentElement;
  return el!.querySelector("ol")!;
};
const progressSteps = () =>
  within(screen.getByRole("list", { name: "Order progress" }))
    .getAllByRole("listitem")
    .map((li) => [li.textContent, li.getAttribute("aria-current")]);

beforeEach(() => vi.setSystemTime(FIXED_NOW));

describe("OrderDetailView — timeline (BOOK-014)", () => {
  it("BOOK-014 — a shipped order shows progress up to Shipped and its events newest first", () => {
    renderWithStore(<OrderDetailView orderId="o-10228" />, { session: { learner: "learnerActive" } });
    expect(screen.getByRole("heading", { level: 1, name: "Order SVB-10228" })).toBeInTheDocument();
    expect(progressSteps()).toEqual([
      ["Order placed", null],
      ["Payment verification", null],
      ["Payment confirmed", null],
      ["Processing", null],
      ["5Shipped", "step"],
      ["6Delivered", null],
    ]);

    const timeline = timelineList();
    const items = within(timeline).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("p")!.textContent)).toEqual([
      "In transit: reached Chennai hub.",
      "Shipped via Delhivery — tracking DLV7734120985IN.",
      "Order moved to Processing.",
      "Payment confirmed.",
      "Payment details submitted (UPI ref 318876541190).",
      expect.stringMatching(/^Order placed/),
    ]);
    expect(items[0]).toHaveTextContent("19 Nov 2026, 10:00 am · Priya Nair");
    // internal admin notes are never shown to the customer
    expect(timeline).not.toHaveTextContent(/Internal note/);
  });

  it("BOOK-014 — another learner cannot open the order", () => {
    renderWithStore(<OrderDetailView orderId="o-10228" />, { session: { learner: "learnerExpired" } });
    expect(screen.getByText("Order not found")).toBeInTheDocument();
  });
});

describe("OrderDetailView — cancellation (BOOK-015)", () => {
  it("BOOK-015 — before payment the customer cancels directly; a reason is required", async () => {
    const { user } = renderWithStore(<OrderDetailView orderId="o-10241" />, { session: { learner: "learnerActive" } });
    await user.click(screen.getByRole("button", { name: /Cancel order/ }));
    const dialog = screen.getByRole("dialog", { name: "Cancel order SVB-10241?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel order" }));
    expect(within(dialog).getByLabelText(/Reason/)).toHaveAccessibleDescription("Tell us briefly why (at least 5 characters).");

    await user.type(within(dialog).getByLabelText(/Reason/), "Ordered the wrong edition");
    await user.click(within(dialog).getByRole("button", { name: "Cancel order" }));
    expect(order("o-10241")).toMatchObject({ status: "cancelled", refunds: [] });
  });

  it("BOOK-015 — after payment the customer can only request cancellation; it is not marked refunded", async () => {
    // o-10230 belongs to Ishita and is paid (processing)
    const { user } = renderWithStore(<OrderDetailView orderId="o-10230" />, { state: createTestState({}, (s) => (s.session.learnerId = "l-ishita")) });
    await user.click(screen.getByRole("button", { name: /Request cancellation/ }));
    const dialog = screen.getByRole("dialog", { name: "Request cancellation?" });
    await user.type(within(dialog).getByLabelText(/Reason/), "No longer needed");
    await user.click(within(dialog).getByRole("button", { name: "Send request" }));

    expect(order("o-10230")).toMatchObject({ status: "processing", cancellation: { status: "requested" }, refunds: [] });
    expect(screen.getByText(/An admin will approve or decline it before dispatch/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Request cancellation/ })).not.toBeInTheDocument();
  });
});

describe("OrderDetailView — returns (BOOK-016)", () => {
  it("BOOK-016 — inside the 7-day window a delivered order can report a problem; details are required", async () => {
    const { user } = renderWithStore(<OrderDetailView orderId="o-10221" />, { session: { learner: "learnerExpired" } });
    expect(screen.getByText(/Report it by/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Report a problem/ }));
    const dialog = screen.getByRole("dialog", { name: "Report a damaged, defective or incorrect book" });

    await user.click(within(dialog).getByRole("button", { name: "Submit request" }));
    expect(within(dialog).getByLabelText(/Details/)).toHaveAccessibleDescription("Describe the problem in a sentence or two.");

    await user.click(within(dialog).getByRole("radio", { name: "Printing/binding defect" }));
    await user.type(within(dialog).getByLabelText(/Details/), "Pages 40 to 60 are printed upside down.");
    await user.click(within(dialog).getByRole("radio", { name: "Refund" }));
    await user.click(within(dialog).getByRole("button", { name: "Submit request" }));

    expect(order("o-10221").returnRequest).toMatchObject({ status: "requested", reason: "defective", preference: "refund" });
    expect(screen.getByText("Return request")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Report a problem/ })).not.toBeInTheDocument();
  });

  it("BOOK-016 — after the window closes no return can be reported", () => {
    const state = createTestState({ learner: "learnerExpired" }, (s) => {
      const o = s.bookOrders.find((x) => x.id === "o-10221")!;
      o.shipment!.deliveredAt = FIXED_NOW - 8 * 86_400_000;
    });
    renderWithStore(<OrderDetailView orderId="o-10221" />, { state });
    expect(screen.queryByRole("button", { name: /Report a problem/ })).not.toBeInTheDocument();
    expect(screen.getByText(/return window ended on/)).toBeInTheDocument();
  });
});
