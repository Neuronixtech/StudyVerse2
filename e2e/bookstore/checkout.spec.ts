import { expect, readStore, switchSession, test } from "../support/fixtures";

type Store = {
  carts: Record<string, { bookId: string; qty: number }[]>;
  bookOrders: { id: string; learnerId: string; status: string; total: number }[];
};

test.describe("Visitor shopping", () => {
  test("BOOK-001 — the bookstore is public", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Bookstore" }).click();
    await expect(page).toHaveURL("/books");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("BOOK-002 — search finds a book by ISBN with or without hyphens", async ({ page }) => {
    await page.goto("/books/catalog");
    const search = page.getByLabel("Search books");
    await search.fill("9788195522079");
    await expect(page.getByRole("heading", { level: 3 })).toHaveText(["Calculus Workbook: 1000 Practice Problems"]);
    await search.fill("978-81-95522-07-9");
    await expect(page.getByRole("heading", { level: 3 })).toHaveText(["Calculus Workbook: 1000 Practice Problems"]);
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(page.getByRole("heading", { level: 3 }).nth(5)).toBeVisible();
  });

  test("BOOK-004 — product detail and photo gallery", async ({ page }) => {
    await page.goto("/books/calculus-workbook");
    await expect(page.getByRole("heading", { level: 1, name: "Calculus Workbook: 1000 Practice Problems" })).toBeVisible();
    const gallery = page.getByRole("tablist", { name: "Choose photo" });
    await gallery.getByRole("tab", { name: "Back cover" }).click();
    await expect(gallery.getByRole("tab", { name: "Back cover" })).toHaveAttribute("aria-selected", "true");
  });

  test("BOOK-005 / BOOK-008 / BOOK-007 — guest cart survives the login prompt into checkout", async ({ page }) => {
    await page.goto("/books/catalog");
    await page.getByRole("button", { name: /^Add to cart\s*:\s*Calculus Workbook: 1000 Practice Problems$/ }).click();
    await page.getByRole("button", { name: /^Add to cart\s*:\s*PCM Formula Handbook \(Pocket\)$/ }).click();
    await expect(page.getByRole("link", { name: "Cart, 2 items" })).toBeVisible();

    await page.getByRole("link", { name: "Cart, 2 items" }).click();
    await page.getByRole("link", { name: /Log in to checkout/ }).click();
    await expect(page).toHaveURL("/login?next=/books/checkout");
    await expect(page.getByRole("main").getByText("Your cart is saved", { exact: true })).toBeVisible();
    expect((await readStore<Store>(page)).bookOrders.filter((o) => o.learnerId === "l-aarav" && o.status === "pending_payment")).toHaveLength(0);

    await page.getByRole("button", { name: /Aarav Mehta/ }).click();
    await expect(page).toHaveURL("/books/checkout");
    const items = page.getByRole("main").getByRole("listitem");
    await expect(items.filter({ hasText: "Calculus Workbook: 1000 Practice Problems" })).toHaveCount(1);
    await expect(items.filter({ hasText: "PCM Formula Handbook (Pocket)" })).toHaveCount(1);
    const store = await readStore<Store>(page);
    expect(store.carts["l-aarav"].map((c) => c.bookId).sort()).toEqual(["b-calculus-workbook", "b-pcm-formula-handbook"]);
    expect(store.carts.guest).toBeUndefined();
  });
});

test.describe("Learner without a learning subscription", () => {
  test.use({ session: { learner: "learnerNoSubscription", admin: "owner" } });

  test("SUB-012 / BOOK-010 / BOOK-012 / BOOK-013 / BOOKADM-006 — checkout, manual payment and admin verification", async ({ page }) => {
    // BOOK-010 — order summary for multiple books
    await page.goto("/books/calculus-workbook");
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await page.goto("/books/pcm-formula-handbook");
    await page.getByRole("button", { name: "Add to cart", exact: true }).click();
    await page.goto("/books/checkout");
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    const total = page.getByText("Total payable").locator("xpath=following-sibling::dd");
    await expect(total).toHaveText("₹817"); // ₹599 + ₹169 = ₹768, below the ₹999 free-shipping threshold → + ₹49
    await page.getByRole("button", { name: /Place order/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Place order" }).click();

    // BOOK-012 — manual payment instructions
    await expect(page).toHaveURL(/\/books\/orders\/o-.+\/payment/);
    await expect(page.getByRole("heading", { name: "Complete your payment" })).toBeVisible();
    await expect(page.getByText("studyverse.books@upi")).toBeVisible();
    await expect(page.getByRole("img", { name: "Demo QR code (not payable)" })).toBeVisible();

    // BOOK-013 — submission moves to verification, not paid
    await page.getByLabel(/UPI transaction ID/).fill("402188761123");
    await page.getByRole("button", { name: "Submit payment details" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("heading", { name: /we're verifying your payment/ })).toBeVisible();
    const order = (await readStore<Store>(page)).bookOrders.find((o) => o.learnerId === "l-aarav" && o.status === "payment_verification" && o.id.startsWith("o-") && o.id !== "o-10233")!;
    expect(order).toBeDefined();

    // BOOKADM-006 — owner approves → Processing
    await page.goto(`/admin/bookstore/orders/${order.id}`);
    await page.getByRole("button", { name: /Approve payment/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox", { name: /I verified/ }).check();
    await dialog.getByRole("button", { name: "Approve payment" }).click();

    await page.goto(`/dashboard/orders/${order.id}`);
    await expect(page.getByText("Processing").first()).toBeVisible();
    expect((await readStore<Store>(page)).bookOrders.find((o) => o.id === order.id)?.status).toBe("processing");
  });
});

test.describe("Staff without payment permission", () => {
  test.use({ session: { admin: "staffCourseManager" } });

  test("BOOKADM-009 — cannot verify payments", async ({ page }) => {
    await page.goto("/admin/bookstore/orders/o-10238");
    await expect(page.getByText(/requires the “Verify payments” permission/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve payment/ })).toHaveCount(0);
    await switchSession(page, { admin: "staffLimited" });
    await page.reload();
    await expect(page.getByRole("button", { name: /Approve payment/ })).toBeVisible();
  });
});
