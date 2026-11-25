import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FIXED_NOW } from "@/test/fixtures/time";
import { setNavigation } from "@/test/mocks/next-navigation";
import { advance, renderWithStore } from "@/test/render";
import { ForgotPasswordForm, ResetPasswordForm } from "./auth-forms";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

/*
 * Route coverage outside the numbered catalogue: /forgot-password and /reset-password.
 * Titles use the "AUTH (password reset)" prefix so they can be traced without adding plan IDs.
 */

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW });
  setNavigation({ path: "/forgot-password" });
});

describe("AUTH (password reset) — forgot password", () => {
  it("AUTH (password reset) — rejects an invalid email and sends nothing", async () => {
    const { user } = renderWithStore(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText(/Email address/), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByLabelText(/Email address/)).toHaveAccessibleDescription("Enter a valid email address");
    await advance(1000);
    expect(screen.queryByRole("heading", { name: "Check your inbox" })).not.toBeInTheDocument();
  });

  it("AUTH (password reset) — confirms without revealing whether the account exists, and says no email is sent", async () => {
    const { user } = renderWithStore(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText(/Email address/), "someone@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    await advance(800);

    expect(screen.getByRole("heading", { name: "Check your inbox" })).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for/)).toHaveTextContent("someone@example.com");
    expect(screen.getByText("Prototype: no email is sent")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open reset link (simulated)" })).toHaveAttribute("href", "/reset-password?email=someone%40example.com");
  });
});

describe("AUTH (password reset) — reset password", () => {
  it("AUTH (password reset) — validates length and confirmation", async () => {
    setNavigation({ path: "/reset-password", search: "email=someone@example.com" });
    const { user } = renderWithStore(<ResetPasswordForm />);
    expect(screen.getByText(/For someone@example.com\./)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^New password/), "short");
    await user.type(screen.getByLabelText(/Confirm new password/), "different");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByLabelText(/^New password/)).toHaveAccessibleDescription("Use at least 8 characters");
    expect(screen.getByLabelText(/Confirm new password/)).toHaveAccessibleDescription("Passwords don't match");
  });

  it("AUTH (password reset) — a valid new password shows the simulated success state", async () => {
    setNavigation({ path: "/reset-password" });
    const { user } = renderWithStore(<ResetPasswordForm />);
    await user.type(screen.getByLabelText(/^New password/), "N3w-password!");
    await user.type(screen.getByLabelText(/Confirm new password/), "N3w-password!");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    await advance(800);

    expect(screen.getByRole("heading", { name: "Password updated" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByText(/Simulated · prototype only/)).toBeInTheDocument();
  });
});
