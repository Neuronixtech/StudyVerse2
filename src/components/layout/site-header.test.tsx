import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getState } from "@/lib/store";
import { createTestState } from "@/test/fixtures/state";
import { FIXED_NOW } from "@/test/fixtures/time";
import { router, setNavigation } from "@/test/mocks/next-navigation";
import { renderWithStore } from "@/test/render";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const mainNav = () => screen.getByRole("navigation", { name: "Main" });

beforeEach(() => {
  vi.setSystemTime(FIXED_NOW);
  setNavigation({ path: "/" });
});

describe("SiteHeader", () => {
  it("PUB-002 — links to Home, Courses, Tests and Bookstore", () => {
    renderWithStore(<SiteHeader />);
    const links = within(mainNav()).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Home", "/"],
      ["Courses", "/courses"],
      ["Tests", "/tests"],
      ["Bookstore", "/books"],
      ["Subscribe", "/subscribe"],
    ]);
  });

  it.each([
    ["/", "Home"],
    ["/courses", "Courses"],
    ["/courses/jee-physics-mechanics", "Courses"],
    ["/tests/t-demo", "Tests"],
    ["/books/cart", "Bookstore"],
  ])("PUB-002 — on %s the active item is %s", (path, active) => {
    setNavigation({ path });
    renderWithStore(<SiteHeader />);
    const current = within(mainNav()).getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(current.map((l) => l.textContent)).toEqual([active]);
  });

  it("a visitor sees Log in / Sign up that return to the current page", () => {
    setNavigation({ path: "/courses" });
    renderWithStore(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=%2Fcourses");
    expect(screen.getByRole("link", { name: "Sign up free" })).toHaveAttribute("href", "/signup?next=%2Fcourses");
  });

  it("shows the signed-in learner's subscription state", () => {
    renderWithStore(<SiteHeader />, { session: { learner: "learnerActive" } });
    expect(screen.getByRole("link", { name: /Active · 64d left/ })).toHaveAttribute("href", "/dashboard/subscription");
    expect(within(mainNav()).queryByRole("link", { name: "Subscribe" })).not.toBeInTheDocument();
  });

  it.each([
    ["learnerNoSubscription", "Not subscribed"],
    ["learnerPending", "Pending approval"],
    ["learnerExpired", "Expired"],
  ] as const)("shows %s as “%s”", (learner, label) => {
    renderWithStore(<SiteHeader />, { session: { learner } });
    expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
  });

  it("AUTH-008 — logging out clears the session and returns to the public site", async () => {
    const { user } = renderWithStore(<SiteHeader />, { session: { learner: "learnerActive" } });
    await user.click(screen.getByRole("button", { name: /Rohan/ }));
    await user.click(screen.getByRole("menuitem", { name: /Log out/ }));

    expect(getState().session.learnerId).toBeNull();
    expect(router.push).toHaveBeenCalledWith("/");
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rohan/ })).not.toBeInTheDocument();
  });

  it("RESP-003 — the mobile menu opens with every destination and closes", async () => {
    const { user } = renderWithStore(<SiteHeader />);
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = screen.getByRole("dialog", { name: "Menu" });
    const links = within(within(drawer).getByRole("navigation", { name: "Mobile" })).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Home", "Courses", "Tests", "Bookstore", "Subscribe"]);

    await user.click(within(drawer).getByRole("button", { name: "Close panel" }));
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
  });

  it("shows the cart count", () => {
    const state = createTestState({}, (s) => (s.carts = { guest: [{ bookId: "b-calculus-workbook", qty: 2, addedAt: FIXED_NOW }] }));
    renderWithStore(<SiteHeader />, { state });
    expect(screen.getByRole("link", { name: "Cart, 2 items" })).toHaveAttribute("href", "/books/cart");
  });
});
