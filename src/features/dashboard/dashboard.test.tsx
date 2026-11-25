import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestState } from "@/test/fixtures/state";
import { FIXED_NOW } from "@/test/fixtures/time";
import { LEARNERS } from "@/test/fixtures/users";
import { renderWithStore } from "@/test/render";
import { AttemptHistory, MySubscription } from "./dashboard-pages";
import { SubscriptionCard } from "./subscription-card";
import { getSubscription } from "@/lib/access";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

beforeEach(() => vi.setSystemTime(FIXED_NOW));

describe("AttemptHistory", () => {
  it("EXAM-027 — lists every attempt with test, date and score, newest first", () => {
    renderWithStore(<AttemptHistory />, { session: { learner: "learnerActive" } });
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    // the active learner has five seeded attempts
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].querySelector("p")?.textContent)).toEqual([
      "Calculus Mastery Test",
      "JEE Main Full Mock Test 01",
      "Physics: Kinematics Chapter Test",
      "Physics: Kinematics Chapter Test",
      "Free Demo Test — JEE Main Pattern",
    ]);
    expect(within(rows[0]).getByRole("link", { name: "Result" })).toHaveAttribute("href", expect.stringMatching(/^\/results\/at-/));
    expect(within(rows[0]).getAllByRole("cell")[2].textContent).toMatch(/^-?\d+\/\d+/);
  });

  it("marks the best of several attempts on the same test", () => {
    renderWithStore(<AttemptHistory />, { session: { learner: "learnerActive" } });
    expect(screen.getAllByText("Best")).toHaveLength(1);
  });

  it("filters by test", async () => {
    const { user } = renderWithStore(<AttemptHistory />, { session: { learner: "learnerActive" } });
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by test" }), "t-kinematics");
    expect(within(screen.getByRole("table")).getAllByRole("row").slice(1)).toHaveLength(2);
  });

  it("SUB-010 — an expired learner still sees their history", () => {
    renderWithStore(<AttemptHistory />, { session: { learner: "learnerExpired" } });
    expect(within(screen.getByRole("table")).getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("STATE-003 — shows an empty state with a next step when there are no attempts", () => {
    const state = createTestState({ learner: "learnerPending" });
    renderWithStore(<AttemptHistory />, { state });
    expect(screen.getByText("No attempts yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse tests" })).toHaveAttribute("href", "/tests");
  });
});

describe("MySubscription", () => {
  it("SUB-004 — a pending request shows its details and blocks a second request", () => {
    renderWithStore(<MySubscription />, { session: { learner: "learnerPending" } });
    expect(screen.getByText("Activation pending")).toBeInTheDocument();
    expect(screen.getByText(/90-day plan · ₹1,299 via UPI/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New request/ })).toBeDisabled();
  });

  it("SUB-006 — a rejected request shows the reason and allows a new request", () => {
    renderWithStore(<MySubscription />, { session: { learner: "learnerRejected" } });
    expect(screen.getByText(/We couldn't find this UPI reference/, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New request/ })).toHaveAttribute("href", "/subscribe");
  });

  it("SUB-009 — an active learner sees the expiry and their periods", () => {
    renderWithStore(<MySubscription />, { session: { learner: "learnerActive" } });
    expect(screen.getByText("64 days left")).toBeInTheDocument();
    expect(screen.getByText("Subscription periods")).toBeInTheDocument();
    expect(screen.getByText(/Approved for 90 days by Priya Nair/)).toBeInTheDocument();
  });

  it("SUB-010 — an expired learner is told what is locked and what is kept", () => {
    renderWithStore(<MySubscription />, { session: { learner: "learnerExpired" } });
    expect(screen.getByText(/Subscription expired on/)).toBeInTheDocument();
    expect(screen.getByText(/Your progress and exam history are safe/)).toBeInTheDocument();
  });
});

describe("SubscriptionCard", () => {
  const card = (learnerId: string | null) => {
    const state = createTestState();
    return renderWithStore(<SubscriptionCard sub={getSubscription(state, learnerId, FIXED_NOW)} />, { state });
  };

  it("invites a learner without a subscription to view plans", () => {
    card(LEARNERS.learnerNoSubscription);
    expect(screen.getByText("Unlock every course and test")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View plans" })).toHaveAttribute("href", "/subscribe");
  });

  it("warns when an active plan is about to expire", () => {
    const state = createTestState({}, (s) => {
      const p = s.periods.find((x) => x.learnerId === LEARNERS.learnerActive)!;
      p.expiresAt = FIXED_NOW + 3 * 86_400_000;
    });
    renderWithStore(<SubscriptionCard sub={getSubscription(state, LEARNERS.learnerActive, FIXED_NOW)} />, { state });
    expect(screen.getByText("Expiring in 3 days")).toBeInTheDocument();
  });
});
