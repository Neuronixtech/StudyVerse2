import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBook } from "@/test/fixtures/bookstore";
import { createTestState } from "@/test/fixtures/state";
import { DAY, FIXED_NOW } from "@/test/fixtures/time";
import { setNavigation } from "@/test/mocks/next-navigation";
import { renderWithStore } from "@/test/render";
import { BookCatalog } from "./storefront";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

/* BOOK-003: each filter and each sort option, applied through the real store. */

const BOOKS = () => [
  makeBook("b-old-cheap", { title: "Old Cheap", price: 150, mrp: 200, sold: 900, createdAt: FIXED_NOW - 90 * DAY, examIds: ["jee-main"], subjectIds: ["physics"], publisher: "Alpha House" }),
  makeBook("b-new-mid", { title: "New Mid", price: 450, mrp: 500, sold: 10, createdAt: FIXED_NOW - 2 * DAY, examIds: ["mht-cet"], subjectIds: ["chemistry"], publisher: "Zeta Press", stock: 0 }),
  makeBook("b-mid-dear", { title: "Mid Dear", price: 900, mrp: 1000, sold: 300, createdAt: FIXED_NOW - 30 * DAY, examIds: ["jee-main", "mht-cet"], subjectIds: ["mathematics"], publisher: "Alpha House" }),
];
const titles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  vi.setSystemTime(FIXED_NOW);
  setNavigation({ path: "/books/catalog" });
});

describe("BookCatalog — sorting (BOOK-003)", () => {
  it.each([
    ["popular", "Most popular", ["Old Cheap", "Mid Dear", "New Mid"]],
    ["newest", "Newest arrivals", ["New Mid", "Mid Dear", "Old Cheap"]],
    ["price-asc", "Price: low to high", ["Old Cheap", "New Mid", "Mid Dear"]],
    ["price-desc", "Price: high to low", ["Mid Dear", "New Mid", "Old Cheap"]],
  ])("BOOK-003 — sort “%s” (%s) orders the results", async (value, _label, expected) => {
    const { user } = renderWithStore(<BookCatalog />, { state: createTestState({}, (s) => (s.books = BOOKS())) });
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort books" }), value);
    expect(titles()).toEqual(expected);
  });

  it("BOOK-003 — sorting keeps the active filters (price band)", async () => {
    const { user } = renderWithStore(<BookCatalog />, { state: createTestState({}, (s) => (s.books = BOOKS())) });
    await user.click(screen.getByRole("radio", { name: "₹300 – ₹600" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort books" }), "price-desc");
    expect(titles()).toEqual(["New Mid"]);
  });
});

describe("BookCatalog — filters (BOOK-003)", () => {
  const render = () => renderWithStore(<BookCatalog />, { state: createTestState({}, (s) => (s.books = BOOKS())) });
  const sorted = () => [...titles()].sort();

  it("BOOK-003 — the exam filter keeps books tagged for that exam", async () => {
    const { user } = render();
    await user.click(screen.getByRole("radio", { name: "MHT-CET" }));
    expect(sorted()).toEqual(["Mid Dear", "New Mid"]);
  });

  it("BOOK-003 — the subject filter keeps books for that subject", async () => {
    const { user } = render();
    await user.click(screen.getByRole("radio", { name: "Chemistry" }));
    expect(titles()).toEqual(["New Mid"]);
  });

  it("BOOK-003 — the availability filter hides out-of-stock books", async () => {
    const { user } = render();
    await user.click(screen.getByRole("checkbox", { name: "Hide out-of-stock books" }));
    expect(sorted()).toEqual(["Mid Dear", "Old Cheap"]);
  });

  it("BOOK-003 — the publisher filter keeps the chosen publisher", async () => {
    const { user } = render();
    await user.click(screen.getByRole("checkbox", { name: "Zeta Press" }));
    expect(titles()).toEqual(["New Mid"]);
  });

  it("BOOK-003 — filters combine, and 'Clear all filters' restores every eligible book", async () => {
    const { user } = render();
    await user.click(screen.getByRole("radio", { name: "JEE Main" }));
    await user.click(screen.getByRole("radio", { name: "Mathematics" }));
    expect(titles()).toEqual(["Mid Dear"]);
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(titles()).toHaveLength(3);
  });
});
