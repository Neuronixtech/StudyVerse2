import { expect, readStore, test } from "../support/fixtures";

// 8×8 red PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP8z4AATEhsPBwAM9EBDq7yZYwAAAAASUVORK5CYII=", "base64");

type Store = { books: { id: string; photos: { label: string; dataUrl?: string }[]; primaryPhotoId: string }[] };

test.describe("Bookstore administration (owner)", () => {
  test.use({ session: { admin: "owner" } });

  test("BOOKADM-001 — the bookstore dashboard renders its metrics", async ({ page }) => {
    await page.goto("/admin/bookstore");
    await expect(page.getByRole("heading", { level: 1, name: "Bookstore overview" })).toBeVisible();
    for (const label of ["Total orders", "Payments to verify", "Low stock", "Out of stock"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("BOOKADM-003 — uploading a photo resizes it in the browser and adds it to the gallery", async ({ page }) => {
    await page.goto("/admin/bookstore/books/b-calculus-workbook");
    await page.getByRole("tab", { name: /^Photos/ }).click();
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: "spine-photo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("spine-photo", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Photos/ })).toContainText("5");

    await page.getByRole("button", { name: /Save changes/ }).click();
    const saved = (await readStore<Store>(page)).books.find((b) => b.id === "b-calculus-workbook")!;
    const upload = saved.photos.find((p) => p.label === "spine-photo")!;
    expect(upload.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });
});

test.describe("Book lifecycle seen from the storefront", () => {
  test.use({ session: { admin: "owner" } });

  test("BOOKADM-004 — draft hidden; published zero-stock shows Out of Stock; archived leaves the storefront", async ({ page }) => {
    const card = () => page.getByRole("article").filter({ hasText: "Modern Physics for JEE Advanced" });

    await page.goto("/books/catalog");
    await expect(card()).toHaveCount(0); // draft

    await page.goto("/admin/bookstore/books/b-modern-physics-advanced");
    await page.getByRole("button", { name: /^Publish$/ }).click();
    await page.getByRole("tab", { name: /^Inventory/ }).click();
    await page.getByRole("button", { name: /Adjust stock/ }).click();
    const dialog = page.getByRole("dialog", { name: "Adjust stock" });
    await dialog.getByRole("radio", { name: "Correct count" }).click();
    await dialog.getByLabel(/Counted quantity on hand/).fill("0");
    await dialog.getByLabel(/^Reason/).fill("Physical count — none on the shelf");
    await dialog.getByRole("button", { name: "Save adjustment" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/books/catalog");
    await expect(card()).toHaveCount(1);
    await expect(card().getByRole("button", { name: /^Out of stock/ })).toBeDisabled();

    await page.goto("/admin/bookstore/books/b-modern-physics-advanced");
    await page.getByRole("button", { name: /Archive/ }).click();
    await expect(page.getByText("Archived").first()).toBeVisible();
    await page.goto("/books/catalog");
    await expect(card()).toHaveCount(0);
  });
});
