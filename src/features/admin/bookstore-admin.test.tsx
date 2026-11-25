import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getState } from "@/lib/store";
import { createTestState } from "@/test/fixtures/state";
import { FIXED_NOW } from "@/test/fixtures/time";
import { ADMINS } from "@/test/fixtures/users";
import { router } from "@/test/mocks/next-navigation";
import { renderWithStore } from "@/test/render";
import { BookCreatePage, BookEditorPage } from "./bookstore-books";
import { BookstoreDashboard, DispatchPage, ReturnsPage } from "./bookstore-ops";
import { OrderAdminDetail } from "./bookstore-orders";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const asOwner = { session: { admin: "owner" as const } };
const book = (id: string) => getState().books.find((b) => b.id === id)!;
const order = (id: string) => getState().bookOrders.find((o) => o.id === id)!;
/** Whole StatCard text (label, value, hint) for the card with this label. */
const stat = (label: string) => screen.getByText(label, { selector: "p" }).parentElement!.parentElement!.textContent;

beforeEach(() => vi.setSystemTime(FIXED_NOW));

describe("BOOKADM-001 — bookstore dashboard", () => {
  it("BOOKADM-001 — metrics match the seeded orders and stock", () => {
    const s = createTestState({ admin: "owner" });
    renderWithStore(<BookstoreDashboard />, { state: s });
    const verify = s.bookOrders.filter((o) => o.status === "payment_verification").length;
    expect(screen.getByRole("heading", { name: "Bookstore overview" })).toBeInTheDocument();
    expect(stat("Total orders")).toContain(String(s.bookOrders.length));
    expect(stat("Payments to verify")).toContain(String(verify));
    expect(stat("Out of stock")).toContain("2"); // solved papers (English) + physical chemistry drills
    expect(screen.getByText("Payments awaiting verification")).toBeInTheDocument();
  });
});

describe("BOOKADM-002 — book metadata", () => {
  it("BOOKADM-002 — the create form validates required fields and price rules", async () => {
    const { user } = renderWithStore(<BookCreatePage />, asOwner);
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(screen.getByLabelText(/^Title/)).toHaveAccessibleDescription("Title is required");
    expect(screen.getByLabelText(/MRP/)).toHaveAccessibleDescription("MRP is required");

    await user.type(screen.getByLabelText(/MRP/), "300");
    await user.type(screen.getByLabelText(/Selling price/), "450");
    await user.type(screen.getByLabelText(/^ISBN/), "12");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(screen.getByLabelText(/Selling price/)).toHaveAccessibleDescription("Selling price can't exceed MRP");
    expect(screen.getByLabelText(/^ISBN/)).toHaveAccessibleDescription("Enter a valid ISBN-10 or ISBN-13 (or leave blank)");
  });

  it("route safety — a title whose URL would be a storefront page is rejected", async () => {
    const { user } = renderWithStore(<BookCreatePage />, asOwner);
    await user.type(screen.getByLabelText(/^Title/), "Checkout");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(screen.getByLabelText(/^Title/)).toHaveAccessibleDescription("“/books/checkout” is a storefront page — add more words to the title");
  });

  it("BOOKADM-002 — a draft with only the required fields is created; optional metadata may stay empty", async () => {
    const { user } = renderWithStore(<BookCreatePage />, asOwner);
    await user.type(screen.getByLabelText(/^Title/), "Optics Drill Book");
    await user.type(screen.getByLabelText(/MRP/), "400");
    await user.type(screen.getByLabelText(/Selling price/), "350");
    await user.click(screen.getByRole("button", { name: "Save as draft" }));

    const created = getState().books.find((b) => b.title === "Optics Drill Book")!;
    expect(created).toMatchObject({ slug: "optics-drill-book", status: "draft", mrp: 400, price: 350, author: undefined, isbn: undefined });
    expect(router.push).toHaveBeenCalledWith(`/admin/bookstore/books/${created.id}`);
  });

  it("BOOKADM-002 — editing metadata saves it and records a price change in the audit log", async () => {
    const { user } = renderWithStore(<BookEditorPage bookId="b-calculus-workbook" />, asOwner);
    await user.clear(screen.getByLabelText(/^Edition/));
    await user.type(screen.getByLabelText(/^Edition/), "2nd edition");
    await user.clear(screen.getByLabelText(/Selling price/));
    await user.type(screen.getByLabelText(/Selling price/), "579");
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(book("b-calculus-workbook")).toMatchObject({ edition: "2nd edition", price: 579 });
    expect(getState().audit.some((a) => a.ref === "b-calculus-workbook" && /Price changed/.test(a.text))).toBe(true);
  });
});

describe("BOOKADM-003 — photo gallery", () => {
  // the caption is the <p> directly inside each gallery tile (the artwork has its own text)
  const photoLabels = () => screen.getAllByRole("listitem").map((li) => li.querySelector(":scope > p")?.textContent).filter(Boolean);

  it("BOOKADM-003 — reorder, change the primary cover and remove photos (exactly one primary)", async () => {
    const { user } = renderWithStore(<BookEditorPage bookId="b-calculus-workbook" />, asOwner);
    await user.click(screen.getByRole("tab", { name: /^Photos/ }));
    expect(photoLabels()).toEqual(["Front cover", "Back cover", "Contents page", "Sample page"]);
    expect(screen.getAllByText("Primary")).toHaveLength(1);

    await user.click(screen.getAllByRole("button", { name: "Move later" })[0]); // Front cover → 2nd
    expect(photoLabels()).toEqual(["Back cover", "Front cover", "Contents page", "Sample page"]);

    await user.click(screen.getAllByRole("button", { name: "Set as primary cover" })[0]); // Back cover
    expect(screen.getAllByText("Primary")).toHaveLength(1);

    await user.click(screen.getAllByRole("button", { name: "Remove photo" })[3]); // Sample page
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    const saved = book("b-calculus-workbook");
    expect(saved.photos.map((p) => p.label)).toEqual(["Back cover", "Front cover", "Contents page"]);
    expect(saved.primaryPhotoId).toBe(saved.photos[0].id);
  });

  it("BOOKADM-003 — removing the primary photo promotes the first remaining one, and the last photo can't be removed", async () => {
    const s = createTestState({ admin: "owner" }, (st) => {
      const b = st.books.find((x) => x.id === "b-calculus-workbook")!;
      b.photos = b.photos.slice(0, 2);
    });
    const { user } = renderWithStore(<BookEditorPage bookId="b-calculus-workbook" />, { state: s });
    await user.click(screen.getByRole("tab", { name: /^Photos/ }));
    await user.click(screen.getAllByRole("button", { name: "Remove photo" })[0]); // the primary cover
    expect(screen.getAllByText("Primary")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeDisabled();
  });

  it("BOOKADM-003 — staff without the photo permission see the gallery read-only", async () => {
    const s = createTestState({ admin: "staffLimited" }, (st) => {
      st.admins = st.admins.map((a) => (a.id === ADMINS.staffLimited ? { ...a, bookPermissions: ["books.edit"] } : a));
    });
    const { user } = renderWithStore(<BookEditorPage bookId="b-calculus-workbook" />, { state: s });
    await user.click(screen.getByRole("tab", { name: /^Photos/ }));
    expect(screen.getByText(/Needs “Manage product photos”/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
  });
});

describe("BOOKADM-004 / BOOKADM-005 — lifecycle and stock", () => {
  it("BOOKADM-004 — publish, archive and restore change the listing status", async () => {
    const { user } = renderWithStore(<BookEditorPage bookId="b-modern-physics-advanced" />, asOwner);
    await user.click(screen.getByRole("button", { name: /^Publish$/ }));
    expect(book("b-modern-physics-advanced").status).toBe("published");
    await user.click(screen.getByRole("button", { name: /Archive/ }));
    expect(book("b-modern-physics-advanced").status).toBe("archived");
    await user.click(screen.getByRole("button", { name: /Restore/ }));
    expect(book("b-modern-physics-advanced").status).toBe("draft");
  });

  it("BOOKADM-005 — a stock adjustment needs a reason, then updates stock and history", async () => {
    const { user } = renderWithStore(<BookEditorPage bookId="b-calculus-workbook" />, asOwner);
    await user.click(screen.getByRole("tab", { name: /^Inventory/ }));
    await user.click(screen.getByRole("button", { name: /Adjust stock/ }));
    const dialog = screen.getByRole("dialog", { name: "Adjust stock" });
    await user.type(within(dialog).getByLabelText(/Copies received/), "5");
    await user.click(within(dialog).getByRole("button", { name: "Save adjustment" }));
    expect(within(dialog).getByLabelText(/^Reason/)).toHaveAccessibleDescription("A reason is required for every adjustment");
    expect(book("b-calculus-workbook").stock).toBe(18);

    await user.type(within(dialog).getByLabelText(/^Reason/), "Printer consignment PR-2231");
    await user.click(within(dialog).getByRole("button", { name: "Save adjustment" }));
    expect(book("b-calculus-workbook").stock).toBe(23);
    expect(getState().stockMovements[0]).toMatchObject({ bookId: "b-calculus-workbook", delta: 5, kind: "added", reason: "Printer consignment PR-2231" });
  });
});

describe("BOOKADM-007 — dispatch and tracking", () => {
  it("BOOKADM-007 — the dispatch queue lists paid orders; dispatch then delivery update the order", async () => {
    const s = createTestState({ admin: "owner" });
    const { user, unmount } = renderWithStore(<DispatchPage />, { state: s });
    expect(screen.getByRole("heading", { name: "Dispatch" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Record dispatch" }).length).toBeGreaterThan(0);
    unmount();

    // o-10230: paid, processing, not on hold
    renderWithStore(<OrderAdminDetail orderId="o-10230" />, { state: getState() });
    await user.click(screen.getByRole("button", { name: /Record dispatch/ }));
    const dialog = screen.getByRole("dialog", { name: "Record dispatch · SVB-10230" });
    await user.click(within(dialog).getByRole("button", { name: /Mark as shipped/ }));
    expect(within(dialog).getByLabelText(/Tracking number/)).toHaveAccessibleDescription("Enter a tracking number or dispatch reference");
    await user.selectOptions(within(dialog).getByLabelText("Courier company"), "DTDC");
    await user.type(within(dialog).getByLabelText(/Tracking number/), "D7788123");
    await user.click(within(dialog).getByRole("button", { name: /Mark as shipped/ }));
    expect(order("o-10230")).toMatchObject({ status: "shipped", shipment: { courier: "DTDC", tracking: "D7788123" } });

    await user.click(screen.getByRole("button", { name: /Mark delivered/ }));
    expect(order("o-10230").status).toBe("delivered");
    expect(order("o-10230").events.filter((e) => e.customerVisible).at(-1)?.text).toBe("Delivered.");
  });
});

describe("BOOKADM-008 — returns and refunds", () => {
  it("BOOKADM-008 — a return is approved with a note, then a mock refund is recorded", async () => {
    const s = createTestState({ admin: "owner" });
    const { user, unmount } = renderWithStore(<ReturnsPage />, { state: s });
    expect(screen.getByRole("tab", { name: /Return requests/ })).toHaveTextContent("1");
    unmount();

    // o-10208: delivered, return requested (damaged, replacement preferred)
    renderWithStore(<OrderAdminDetail orderId="o-10208" />, { state: getState() });
    await user.click(screen.getByRole("button", { name: "Review request" }));
    const dialog = screen.getByRole("dialog", { name: "Return request · SVB-10208" });
    await user.click(within(dialog).getByRole("button", { name: "Approve return" }));
    expect(within(dialog).getByLabelText(/Note to customer/)).toHaveAccessibleDescription("Add a note for the customer");
    await user.type(within(dialog).getByLabelText(/Note to customer/), "Damage confirmed from your photos.");
    await user.click(within(dialog).getByRole("button", { name: "Approve return" }));
    expect(order("o-10208")).toMatchObject({ status: "returned", returnRequest: { status: "approved" } });

    await user.click(screen.getAllByRole("button", { name: /Record refund/ })[0]);
    const refund = screen.getByRole("dialog", { name: "Record refund · SVB-10208" });
    expect(refund).toHaveTextContent(/Paid/);
    await user.clear(within(refund).getByLabelText(/Refund amount/));
    await user.type(within(refund).getByLabelText(/Refund amount/), "299");
    await user.click(within(refund).getByRole("button", { name: "Record refund" }));
    expect(within(refund).getByText("Enter the refund transaction reference")).toBeInTheDocument();
    await user.type(within(refund).getByLabelText(/Refund reference/), "RFND-123456");
    await user.click(within(refund).getByRole("button", { name: "Record refund" }));
    expect(order("o-10208").refunds.at(-1)).toMatchObject({ amount: 299, context: "return", reference: "RFND-123456", status: "completed" });
  });
});
