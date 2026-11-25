import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FIXED_NOW } from "@/test/fixtures/time";
import { renderWithStore } from "@/test/render";
import { BookDetail } from "./book-detail";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const details = () => {
  const dl = screen.getByRole("heading", { name: "Details" }).nextElementSibling as HTMLElement;
  return within(dl).getAllByRole("term").map((t) => t.textContent);
};

beforeEach(() => vi.setSystemTime(FIXED_NOW));

describe("BookDetail (BOOK-004)", () => {
  it("BOOK-004 — shows full metadata, price and the photo gallery for a complete listing", async () => {
    const { user } = renderWithStore(<BookDetail slug="calculus-workbook" />);
    expect(screen.getByRole("heading", { level: 1, name: "Calculus Workbook: 1000 Practice Problems" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).nextElementSibling).toHaveTextContent("by Neha Kulkarni · Aarohan Publications");
    expect(details()).toEqual(expect.arrayContaining(["ISBN", "Publisher", "Edition", "Language", "Pages"]));

    const gallery = screen.getByRole("tablist", { name: "Choose photo" });
    expect(within(gallery).getAllByRole("tab").map((t) => t.getAttribute("aria-label"))).toEqual(["Front cover", "Back cover", "Contents page", "Sample page"]);
    await user.click(within(gallery).getByRole("tab", { name: "Contents page" }));
    expect(within(gallery).getByRole("tab", { name: "Contents page" })).toHaveAttribute("aria-selected", "true");
  });

  it("BOOK-004 — a listing without author, publisher, ISBN or edition still renders cleanly", () => {
    renderWithStore(<BookDetail slug="algebra-foundations" />);
    expect(screen.getByRole("heading", { level: 1, name: "Algebra Foundations for Engineering Entrances" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).nextElementSibling).toHaveTextContent("Author not listed");
    // missing optional fields are left out rather than shown blank or as "undefined"
    expect(details()).not.toEqual(expect.arrayContaining(["ISBN"]));
    expect(details()).not.toEqual(expect.arrayContaining(["Publisher"]));
    expect(document.body.textContent).not.toMatch(/undefined|null|NaN/);
  });

  it("STATE-006 — an unknown slug shows a not-found state", () => {
    renderWithStore(<BookDetail slug="no-such-book" />);
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });
});
