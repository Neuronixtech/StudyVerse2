import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddressesPage } from "@/features/bookstore/my-orders";
import { getState } from "@/lib/store";
import { createTestState } from "@/test/fixtures/state";
import { FIXED_NOW } from "@/test/fixtures/time";
import { LEARNERS } from "@/test/fixtures/users";
import { renderWithStore } from "@/test/render";
import { ProfileSettings } from "./dashboard-pages";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

/* Route coverage outside the numbered catalogue: /dashboard/profile and /dashboard/addresses. */

const ME = LEARNERS.learnerActive;
const me = () => getState().learners.find((l) => l.id === ME)!;
const myAddresses = () => getState().addresses.filter((a) => a.learnerId === ME);

beforeEach(() => vi.setSystemTime(FIXED_NOW));

describe("LEARNER (profile) — personal details", () => {
  it("LEARNER (profile) — shows the current details and keeps Save disabled until something changes", () => {
    renderWithStore(<ProfileSettings />, { session: { learner: "learnerActive" } });
    expect(screen.getByRole("heading", { name: "Profile & settings" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Rohan Iyer");
    expect(screen.getByLabelText(/^Email/)).toHaveValue("rohan@example.com");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("LEARNER (profile) — validates name, email and mobile; invalid edits are not saved (STATE-005)", async () => {
    const { user } = renderWithStore(<ProfileSettings />, { session: { learner: "learnerActive" } });
    await user.clear(screen.getByLabelText(/^Email/));
    await user.type(screen.getByLabelText(/^Email/), "rohan@");
    await user.clear(screen.getByLabelText(/Mobile number/));
    await user.type(screen.getByLabelText(/Mobile number/), "12345");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByLabelText(/^Email/)).toHaveAccessibleDescription("Enter a valid email");
    expect(screen.getByLabelText(/Mobile number/)).toHaveAccessibleDescription("Enter a valid 10-digit mobile number");
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Rohan Iyer");
    expect(me().email).toBe("rohan@example.com");
  });

  it("LEARNER (profile) — saves valid changes to the mock store", async () => {
    const { user } = renderWithStore(<ProfileSettings />, { session: { learner: "learnerActive" } });
    await user.clear(screen.getByLabelText(/^City/));
    await user.type(screen.getByLabelText(/^City/), "Kota");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(me().city).toBe("Kota");
    expect(screen.getByText("Profile updated")).toBeInTheDocument();
  });

  it("LEARNER (profile) — password change is validated and clearly simulated", async () => {
    const { user } = renderWithStore(<ProfileSettings />, { session: { learner: "learnerActive" } });
    await user.click(screen.getByRole("button", { name: /Update password/ }));
    expect(screen.getByLabelText("Current password")).toHaveAccessibleDescription("Enter your current password");

    await user.type(screen.getByLabelText("Current password"), "old-password");
    await user.type(screen.getByLabelText("New password"), "N3w-password!");
    await user.type(screen.getByLabelText("Confirm new password"), "N3w-password!");
    await user.click(screen.getByRole("button", { name: /Update password/ }));
    expect(screen.getByText("No real credentials exist in the prototype.")).toBeInTheDocument();
  });
});

describe("LEARNER (addresses) — saved addresses", () => {
  it("LEARNER (addresses) — lists saved addresses with the default first", () => {
    renderWithStore(<AddressesPage />, { session: { learner: "learnerActive" } });
    const cards = screen.getAllByRole("button", { name: /^Delete address for/ });
    expect(cards.map((b) => b.getAttribute("aria-label"))).toEqual(["Delete address for Rohan Iyer, Chennai", "Delete address for Rohan Iyer, Kota"]);
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("LEARNER (addresses) — adds a validated address (BOOK-009)", async () => {
    const { user } = renderWithStore(<AddressesPage />, { session: { learner: "learnerActive" } });
    await user.click(screen.getByRole("button", { name: /Add address/ }));
    const dialog = screen.getByRole("dialog", { name: "Add address" });
    await user.click(within(dialog).getByRole("button", { name: "Save address" }));
    expect(within(dialog).getByLabelText(/PIN code/)).toHaveAccessibleDescription("Enter a valid 6-digit PIN code");

    await user.type(within(dialog).getByLabelText(/Full name/), "Rohan Iyer");
    await user.type(within(dialog).getByLabelText(/Mobile number/), "9444077889");
    await user.type(within(dialog).getByLabelText(/House \/ building/), "12 Park Street");
    await user.type(within(dialog).getByLabelText(/Locality/), "Park Street");
    await user.type(within(dialog).getByLabelText(/^City/), "Kolkata");
    await user.selectOptions(within(dialog).getByLabelText(/^State/), "West Bengal");
    await user.type(within(dialog).getByLabelText(/PIN code/), "700016");
    await user.click(within(dialog).getByRole("button", { name: "Save address" }));

    expect(myAddresses().map((a) => a.city)).toContain("Kolkata");
    expect(screen.queryByRole("dialog", { name: "Add address" })).not.toBeInTheDocument();
  });

  it("LEARNER (addresses) — changes the default and deletes an address after confirmation", async () => {
    const { user } = renderWithStore(<AddressesPage />, { session: { learner: "learnerActive" } });
    await user.click(screen.getByRole("button", { name: "Set as default" }));
    expect(myAddresses().find((a) => a.isDefault)?.city).toBe("Kota");

    await user.click(screen.getByRole("button", { name: "Delete address for Rohan Iyer, Chennai" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete this address?" })).getByRole("button", { name: "Delete" }));
    expect(myAddresses().map((a) => a.city)).toEqual(["Kota"]);
  });

  it("LEARNER (addresses) — shows an empty state when there are none", () => {
    const state = createTestState({ learner: "learnerActive" }, (s) => (s.addresses = s.addresses.filter((a) => a.learnerId !== ME)));
    renderWithStore(<AddressesPage />, { state });
    expect(screen.getByText("No saved addresses")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Add address/ }).length).toBeGreaterThan(0);
  });
});
