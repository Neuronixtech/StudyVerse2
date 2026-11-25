import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getState } from "@/lib/store";
import { FIXED_NOW } from "@/test/fixtures/time";
import { LEARNERS } from "@/test/fixtures/users";
import { router, setNavigation } from "@/test/mocks/next-navigation";
import { advance, renderWithStore } from "@/test/render";
import { LoginForm, SignupForm } from "./auth-forms";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const email = () => screen.getByLabelText(/Email/);
const password = () => screen.getByLabelText(/^Password/);

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW });
  setNavigation({ path: "/login" });
});

describe("LoginForm", () => {
  it("AUTH-001 — renders labelled email and password fields and a submit button", () => {
    renderWithStore(<LoginForm />);
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(email()).toHaveAttribute("type", "email");
    expect(password()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /^Log in/ })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Create a free account" })).toHaveAttribute("href", "/signup");
  });

  it("AUTH-002 — an empty submit shows required-field errors and does not log in", async () => {
    const { user } = renderWithStore(<LoginForm />);
    await user.click(screen.getByRole("button", { name: /^Log in/ }));

    expect(email()).toHaveAccessibleDescription("Enter your email address");
    expect(password()).toHaveAccessibleDescription("Enter your password");
    expect(email()).toHaveAttribute("aria-invalid", "true");
    await advance(1000);
    expect(getState().session.learnerId).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("AUTH-003 — a malformed email is rejected", async () => {
    const { user } = renderWithStore(<LoginForm />);
    await user.type(email(), "aarav@example");
    await user.type(password(), "secret123");
    await user.click(screen.getByRole("button", { name: /^Log in/ }));

    expect(email()).toHaveAccessibleDescription("Enter a valid email address");
    await advance(1000);
    expect(getState().session.learnerId).toBeNull();
  });

  it("rejects a password shorter than 6 characters", async () => {
    const { user } = renderWithStore(<LoginForm />);
    await user.type(email(), "aarav@example.com");
    await user.type(password(), "12345");
    await user.click(screen.getByRole("button", { name: /^Log in/ }));
    expect(password()).toHaveAccessibleDescription("Password must be at least 6 characters");
  });

  it("AUTH-004 — valid fixture credentials sign in and go to the requested page", async () => {
    setNavigation({ path: "/login", search: "next=/courses/jee-physics-mechanics" });
    const { user } = renderWithStore(<LoginForm />);
    await user.type(email(), "ROHAN@example.com ");
    await user.type(password(), "anything");
    await user.click(screen.getByRole("button", { name: /^Log in/ }));
    await advance(700);

    expect(getState().session.learnerId).toBe(LEARNERS.learnerActive);
    expect(router.replace).toHaveBeenCalledWith("/courses/jee-physics-mechanics");
    expect(await screen.findByText("Welcome back, Rohan!")).toBeInTheDocument();
    expect(screen.getByText(/Simulated · prototype only/)).toBeInTheDocument();
  });

  it("defaults to the dashboard and refuses off-site redirects", async () => {
    setNavigation({ path: "/login", search: "next=//evil.example.com" });
    const { user } = renderWithStore(<LoginForm />);
    await user.type(email(), "rohan@example.com");
    await user.type(password(), "anything");
    await user.click(screen.getByRole("button", { name: /^Log in/ }));
    await advance(700);
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("explains when no account matches the email", async () => {
    const { user } = renderWithStore(<LoginForm />);
    await user.type(email(), "nobody@example.com");
    await user.type(password(), "secret123");
    await user.click(screen.getByRole("button", { name: /^Log in/ }));
    await advance(700);

    expect(screen.getByText("We couldn't find an account with that email.")).toBeInTheDocument();
    expect(getState().session.learnerId).toBeNull();
  });

  it("one-click demo personas sign in as that persona", async () => {
    const { user } = renderWithStore(<LoginForm />);
    await user.click(screen.getByRole("button", { name: /Sneha Patil/ }));
    expect(getState().session.learnerId).toBe(LEARNERS.learnerExpired);
  });

  it("BOOK-007 — tells a shopper their cart is kept when logging in for checkout", () => {
    setNavigation({ path: "/login", search: "next=/books/checkout" });
    renderWithStore(<LoginForm />);
    expect(screen.getByText("Your cart is saved")).toBeInTheDocument();
  });

  it("AUTH-007 — Google sign-in is clearly unavailable in the prototype", () => {
    renderWithStore(<LoginForm />);
    const google = screen.getByRole("button", { name: /Continue with Google/ });
    expect(google).toBeDisabled();
    expect(google).toHaveTextContent("Not in prototype");
  });
});

describe("SignupForm", () => {
  const field = (label: RegExp) => screen.getByLabelText(label);

  beforeEach(() => setNavigation({ path: "/signup" }));

  it("AUTH-005 — empty submit flags every required field and adds no account", async () => {
    const { user } = renderWithStore(<SignupForm />);
    const before = getState().learners.length;
    await user.click(screen.getByRole("button", { name: /Create account/ }));

    expect(field(/Full name/)).toHaveAccessibleDescription("Enter your full name");
    expect(field(/^Email/)).toHaveAccessibleDescription("Enter a valid email address");
    expect(field(/Mobile number/)).toHaveAccessibleDescription("Enter a valid 10-digit Indian mobile number");
    expect(field(/^Password/)).toHaveAccessibleDescription("Use at least 8 characters");
    expect(screen.getByText("Please accept the terms to continue")).toBeInTheDocument();
    await advance(1000);
    expect(getState().learners).toHaveLength(before);
  });

  it("AUTH-005 — mismatched passwords and an existing email are rejected", async () => {
    const { user } = renderWithStore(<SignupForm />);
    await user.type(field(/^Email/), "aarav@example.com");
    await user.type(field(/^Password/), "longenough1");
    await user.type(field(/Confirm password/), "different1");
    await user.click(screen.getByRole("button", { name: /Create account/ }));

    expect(field(/^Email/)).toHaveAccessibleDescription(/already exists/);
    expect(field(/Confirm password/)).toHaveAccessibleDescription("Passwords don't match");
  });

  it("STATE-005 — valid fields keep their values when another field is invalid", async () => {
    const { user } = renderWithStore(<SignupForm />);
    await user.type(field(/Full name/), "Ananya Sharma");
    await user.type(field(/^Email/), "ananya.new@example.com");
    await user.click(screen.getByRole("button", { name: /Create account/ }));

    expect(field(/Full name/)).toHaveValue("Ananya Sharma");
    expect(field(/^Email/)).toHaveValue("ananya.new@example.com");
    expect(field(/Full name/)).not.toHaveAttribute("aria-invalid");
  });

  it("AUTH-006 — valid details create a simulated account and sign in, without claiming real email delivery", async () => {
    setNavigation({ path: "/signup", search: "next=/subscribe" });
    const { user } = renderWithStore(<SignupForm />);
    await user.type(field(/Full name/), "Ananya Sharma");
    await user.type(field(/^Email/), "Ananya.New@example.com");
    await user.type(field(/Mobile number/), "98765 43210");
    await user.type(field(/^Password/), "Str0ng!pass");
    await user.type(field(/Confirm password/), "Str0ng!pass");
    await user.click(screen.getByRole("checkbox", { name: /I agree to the Terms/ }));
    await user.click(screen.getByRole("button", { name: /Create account/ }));
    await act(() => vi.advanceTimersByTimeAsync(800));

    const created = getState().learners.find((l) => l.email === "ananya.new@example.com");
    expect(created).toMatchObject({ name: "Ananya Sharma", targetExam: "jee-main", targetYear: 2027 });
    expect(getState().session.learnerId).toBe(created!.id);
    expect(router.replace).toHaveBeenCalledWith("/subscribe");
    expect(screen.getByText(/no account is created on a server/)).toBeInTheDocument();
    expect(screen.getByText(/Email verification and OTP are not part of the UI prototype/)).toBeInTheDocument();
  });

  it("shows a password strength meter", async () => {
    const { user } = renderWithStore(<SignupForm />);
    await user.type(field(/^Password/), "abc");
    expect(screen.getByText("Very weak")).toBeInTheDocument();
    await user.type(field(/^Password/), "DEF12345!");
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });
});
