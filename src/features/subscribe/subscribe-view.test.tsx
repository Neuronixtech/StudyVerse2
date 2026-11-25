import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getState } from "@/lib/store";
import { FIXED_NOW } from "@/test/fixtures/time";
import { LEARNERS } from "@/test/fixtures/users";
import { setNavigation } from "@/test/mocks/next-navigation";
import { renderWithStore } from "@/test/render";
import { SubscribeView } from "./subscribe-view";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const plans = () => within(screen.getByRole("radiogroup", { name: /Choose your duration/ })).getAllByRole("radio");
const reference = () => screen.getByLabelText(/UPI transaction ID|Bank reference number/);

beforeEach(() => {
  vi.setSystemTime(FIXED_NOW);
  setNavigation({ path: "/subscribe" });
});

describe("SubscribeView — plans", () => {
  it("SUB-001 — shows the 30, 90 and 365-day plans with configured prices", () => {
    renderWithStore(<SubscribeView />);
    expect(plans().map((p) => p.textContent)).toEqual([
      expect.stringMatching(/Monthly.*₹499.*30 days of full access/),
      expect.stringMatching(/Most popular.*Quarterly.*₹1,299.*90 days of full access/),
      expect.stringMatching(/Annual.*₹3,999.*365 days of full access/),
    ]);
  });

  it("SUB-002 — selecting a plan updates the selection and the amount to pay", async () => {
    const { user } = renderWithStore(<SubscribeView />, { session: { learner: "learnerNoSubscription" } });
    expect(plans()[1]).toHaveAttribute("aria-checked", "true");

    await user.click(plans()[2]);
    expect(plans()[2]).toHaveAttribute("aria-checked", "true");
    expect(plans()[1]).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Amount to pay").nextElementSibling).toHaveTextContent("₹3,999");
    expect(screen.getByLabelText("Plan")).toHaveValue("Annual · 365 days");
  });

  it("preselects the plan from the URL", () => {
    setNavigation({ path: "/subscribe", search: "plan=30" });
    renderWithStore(<SubscribeView />);
    expect(plans()[0]).toHaveAttribute("aria-checked", "true");
  });

  it("asks a visitor to sign in before submitting a request", () => {
    renderWithStore(<SubscribeView />);
    expect(screen.getByText("Sign in to unlock activation requests")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit activation request" })).not.toBeInTheDocument();
  });

  it("labels payment details as demo-only", () => {
    renderWithStore(<SubscribeView />);
    expect(screen.getByRole("img", { name: "Demo QR code (not payable)" })).toBeInTheDocument();
    expect(screen.getByText(/do not send real money/)).toBeInTheDocument();
  });
});

describe("SubscribeView — activation request", () => {
  it("validates the transaction reference format", async () => {
    const { user } = renderWithStore(<SubscribeView />, { session: { learner: "learnerNoSubscription" } });
    await user.click(screen.getByRole("button", { name: "Submit activation request" }));
    expect(reference()).toHaveAccessibleDescription("Enter the transaction or reference ID");

    await user.type(reference(), "12345");
    await user.click(screen.getByRole("button", { name: "Submit activation request" }));
    expect(reference()).toHaveAccessibleDescription("UPI transaction IDs (UTR) are 12 digits");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("SUB-003 — a valid request is confirmed, stored as Pending and grants no access", async () => {
    const { user } = renderWithStore(<SubscribeView />, { session: { learner: "learnerNoSubscription" } });
    await user.click(plans()[0]);
    await user.type(reference(), "402188761123");
    await user.click(screen.getByRole("button", { name: "Submit activation request" }));

    const dialog = screen.getByRole("dialog", { name: "Confirm your request" });
    expect(within(dialog).getByText("Monthly · 30 days")).toBeInTheDocument();
    expect(within(dialog).getByText("₹499")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Submit request" }));

    const req = getState().requests.find((r) => r.learnerId === LEARNERS.learnerNoSubscription)!;
    expect(req).toMatchObject({ planDays: 30, amount: 499, method: "upi", reference: "402188761123", status: "pending" });
    expect(screen.getByRole("heading", { name: "Request submitted" })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(getState().periods.some((p) => p.learnerId === LEARNERS.learnerNoSubscription)).toBe(false);
    expect(screen.getByText("Activation request submitted")).toBeInTheDocument();
    expect(screen.getAllByText(/Simulated · prototype only/).length).toBeGreaterThan(0);
  });

  it("warns when the amount differs from the plan price", async () => {
    const { user } = renderWithStore(<SubscribeView />, { session: { learner: "learnerNoSubscription" } });
    const amount = screen.getByLabelText(/Amount paid/);
    await user.clear(amount);
    await user.type(amount, "1000");
    await user.type(reference(), "402188761123");
    await user.click(screen.getByRole("button", { name: "Submit activation request" }));
    expect(screen.getByText(/The amount differs from the plan price/)).toBeInTheDocument();
  });

  it("SUB-004 — a learner with a pending request cannot submit another", () => {
    renderWithStore(<SubscribeView />, { session: { learner: "learnerPending" } });
    expect(screen.getByText("You already have a pending request")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit activation request" })).not.toBeInTheDocument();
  });

  it("SUB-007 — a rejected learner sees the reason and can submit again", () => {
    renderWithStore(<SubscribeView />, { session: { learner: "learnerRejected" } });
    expect(screen.getByText("Your previous request was rejected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit activation request" })).toBeEnabled();
  });

  it("SUB-011 — renewing an active plan explains that days are added to the current expiry", () => {
    renderWithStore(<SubscribeView />, { session: { learner: "learnerActive" } });
    expect(screen.getByText("Renewing an active plan")).toBeInTheDocument();
    // current expiry 23 Jan 2027 + 90 days ≈ 23 Apr 2027
    expect(screen.getByText(/runs until 23 Jan 2027.*new expiry about 23 Apr 2027/)).toBeInTheDocument();
  });
});
