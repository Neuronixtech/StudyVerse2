import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSubscription } from "@/lib/access";
import { getState } from "@/lib/store";
import { createTestState } from "@/test/fixtures/state";
import { DAY, FIXED_NOW } from "@/test/fixtures/time";
import { ADMINS, LEARNERS } from "@/test/fixtures/users";
import { renderWithStore } from "@/test/render";
import { LearnerDetail, LearnersPage } from "./admin-learners";
import { SubscriptionsPage } from "./admin-subscriptions";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

/* Route coverage: /admin/learners, /admin/learners/[learnerId], /admin/subscriptions. */

const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const sub = (id: string) => getSubscription(getState(), id, FIXED_NOW);

beforeEach(() => vi.setSystemTime(FIXED_NOW));

describe("ADMIN (learners) — learner directory", () => {
  it("ADMIN (learners) — lists every learner with subscription state and links to the detail page", () => {
    renderWithStore(<LearnersPage />, { session: { admin: "owner" } });
    expect(screen.getByRole("heading", { name: "Learners" })).toBeInTheDocument();
    expect(rows()).toHaveLength(12);
    const rohan = rows().find((r) => r.textContent?.includes("Rohan Iyer"))!;
    expect(rohan).toHaveTextContent("Active");
    expect(within(rohan).getByRole("link", { name: /Rohan Iyer/ })).toHaveAttribute("href", "/admin/learners/l-rohan");
  });

  it("ADMIN (learners) — search and status filter narrow the list", async () => {
    const { user } = renderWithStore(<LearnersPage />, { session: { admin: "owner" } });
    await user.type(screen.getByPlaceholderText("Search name, email, phone or city"), "Nashik");
    expect(rows().map((r) => r.textContent)).toEqual([expect.stringContaining("Sneha Patil")]);

    await user.clear(screen.getByPlaceholderText("Search name, email, phone or city"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by subscription status" }), "expired");
    expect(rows().length).toBeGreaterThan(0);
    expect(rows().every((r) => /Expired/.test(r.textContent ?? ""))).toBe(true);
  });

  it("ADMIN-014 — staff without the learners permission are denied", () => {
    renderWithStore(<LearnersPage />, { session: { admin: "staffCourseManager" } });
    expect(screen.getByRole("heading", { name: "You don't have access" })).toBeInTheDocument();
  });
});

describe("ADMIN (learners) — learner detail and manual activation", () => {
  it("ADMIN (learners) — shows the learner, their subscription periods and requests", () => {
    renderWithStore(<LearnerDetail learnerId="l-rohan" />, { session: { admin: "owner" } });
    expect(screen.getByRole("heading", { level: 1, name: "Rohan Iyer" })).toBeInTheDocument();
    expect(screen.getByText(/Active until .* · 64 days left/)).toBeInTheDocument();
  });

  it("SUB-011 — manual activation for an active learner extends the current expiry", async () => {
    const before = sub(LEARNERS.learnerActive).expiresAt!;
    const { user } = renderWithStore(<LearnerDetail learnerId="l-rohan" />, { session: { admin: "owner" } });
    await user.click(screen.getByRole("button", { name: /Activate manually/ }));
    const dialog = screen.getByRole("dialog", { name: "Activate subscription for Rohan Iyer" });
    await user.click(within(dialog).getByRole("radio", { name: "30 days" }));
    expect(dialog).toHaveTextContent("(extends current expiry)");
    await user.click(within(dialog).getByRole("button", { name: "Activate" }));

    expect(sub(LEARNERS.learnerActive).expiresAt).toBe(before + 30 * DAY);
    expect(sub(LEARNERS.learnerActive).periods).toHaveLength(2);
  });

  it("ADMIN (learners) — manual activation for an expired learner starts today", async () => {
    const { user } = renderWithStore(<LearnerDetail learnerId="l-sneha" />, { session: { admin: "owner" } });
    await user.click(screen.getByRole("button", { name: /Activate manually/ }));
    const dialog = screen.getByRole("dialog", { name: "Activate subscription for Sneha Patil" });
    await user.click(within(dialog).getByRole("button", { name: "Activate" }));
    expect(sub(LEARNERS.learnerExpired)).toMatchObject({ status: "active" });
  });

  it("ADMIN-014 — staff with learners but not subscriptions can view the learner but not activate", () => {
    const state = createTestState({ admin: "staffLimited" }, (s) => {
      s.admins = s.admins.map((a) => (a.id === ADMINS.staffLimited ? { ...a, permissions: ["learners"] } : a));
    });
    renderWithStore(<LearnerDetail learnerId="l-rohan" />, { state });
    expect(screen.getByRole("heading", { level: 1, name: "Rohan Iyer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Activate manually/ })).not.toBeInTheDocument();
  });

  it("STATE-006 — an unknown learner shows a not-found state", () => {
    renderWithStore(<LearnerDetail learnerId="l-nobody" />, { session: { admin: "owner" } });
    expect(screen.getByText("Learner not found")).toBeInTheDocument();
  });
});

describe("ADMIN (subscriptions) — subscription records", () => {
  it("ADMIN (subscriptions) — summarises active, expiring and expired records", () => {
    renderWithStore(<SubscriptionsPage />, { session: { admin: "owner" } });
    expect(screen.getByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Active/ })).toHaveAttribute("aria-selected", "true");
    expect(rows().some((r) => r.textContent?.includes("Rohan Iyer"))).toBe(true);
  });

  it("ADMIN (subscriptions) — the expired tab lists expired learners only", async () => {
    const { user } = renderWithStore(<SubscriptionsPage />, { session: { admin: "owner" } });
    await user.click(screen.getByRole("tab", { name: /^Expired/ }));
    const names = rows().map((r) => r.textContent ?? "");
    expect(names.some((n) => n.includes("Sneha Patil"))).toBe(true);
    expect(names.some((n) => n.includes("Rohan Iyer"))).toBe(false);
  });
});
