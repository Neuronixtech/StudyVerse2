import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getState } from "@/lib/store";
import { createTestState, type TestStateOptions } from "@/test/fixtures/state";
import { DAY, FIXED_NOW } from "@/test/fixtures/time";
import { ADMINS, LEARNERS } from "@/test/fixtures/users";
import { setNavigation } from "@/test/mocks/next-navigation";
import { renderWithStore } from "@/test/render";
import { CoursesAdminPage } from "./admin-courses";
import { StaffPage } from "./admin-settings";
import { AdminShell } from "./admin-shell";
import { ReviewRequestDialog, RequestsPage } from "./admin-subscriptions";
import { TestsAdminPage } from "./admin-tests";
import { BookstoreSettingsPage } from "./bookstore-ops";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const asAdmin = (admin: TestStateOptions["admin"]) => ({ session: { admin } });

beforeEach(() => {
  vi.setSystemTime(FIXED_NOW);
  setNavigation({ path: "/admin" });
});

describe("AdminShell", () => {
  const navLink = (name: RegExp) => within(screen.getAllByRole("navigation", { name: "Admin" })[0]).getByRole("link", { name });

  it("asks for admin sign-in when no admin session exists", () => {
    renderWithStore(
      <AdminShell>
        <p>Secret admin page</p>
      </AdminShell>,
      { session: { learner: "learnerActive" } },
    );
    expect(screen.getByRole("heading", { name: "Admin sign-in required" })).toBeInTheDocument();
    expect(screen.getByText("Secret admin page")).not.toBeVisible();
  });

  it("ADMIN-001 — renders the console for the owner with every section unlocked", () => {
    renderWithStore(<AdminShell>dashboard</AdminShell>, asAdmin("owner"));
    for (const name of [/^Courses/, /^Tests/, /^Learners/, /^Activation requests/, /^Admins & staff/, /^Store settings/]) {
      expect(navLink(name)).not.toHaveAccessibleName(/Restricted/);
    }
    expect(navLink(/^Activation requests/)).toHaveTextContent("3"); // pending badge
  });

  it("ADMIN-013 / ADMIN-014 — staff see restricted sections marked as such", () => {
    renderWithStore(<AdminShell>dashboard</AdminShell>, asAdmin("staffLimited"));
    expect(navLink(/^Courses/)).toHaveAccessibleName(/Restricted/);
    expect(navLink(/^Tests/)).toHaveAccessibleName(/Restricted/);
    expect(navLink(/^Admins & staff/)).toHaveAccessibleName(/Restricted/);
    expect(navLink(/^Admins & staff/)).toHaveAttribute("title", "Owner only");
    expect(navLink(/^Learners/)).not.toHaveAccessibleName(/Restricted/);
  });
});

describe("ADMIN-013 / ADMIN-014 / BOOKADM-009 — page-level permission checks", () => {
  it.each([
    ["Courses", "staffLimited", "You don't have access", <CoursesAdminPage key="c" />],
    ["Tests", "staffLimited", "You don't have access", <TestsAdminPage key="t" />],
    ["Admins & staff", "staffCourseManager", "Owner only", <StaffPage key="s" />],
    ["Bookstore settings", "staffCourseManager", "Owner only", <BookstoreSettingsPage key="b" />],
  ] as const)("%s is denied to %s (“%s”)", (_name, admin, title, page) => {
    renderWithStore(page, asAdmin(admin));
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/admin");
  });

  it("staffCourseManager can open course management", () => {
    renderWithStore(<CoursesAdminPage />, asAdmin("staffCourseManager"));
    expect(screen.getByRole("heading", { name: "Courses" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New course/ })).toHaveAttribute("href", "/admin/courses/new");
  });

  it("ADMIN-012 — the owner can manage staff and invite admins", () => {
    renderWithStore(<StaffPage />, asAdmin("owner"));
    expect(screen.getByRole("heading", { name: "Admins & staff" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Invite admin/ })).toBeInTheDocument();
    expect(screen.getByText("Priya Nair")).toBeInTheDocument();
  });

  it("COURSE-002 — draft and archived courses are listed for admins", async () => {
    const { user } = renderWithStore(<CoursesAdminPage />, asAdmin("owner"));
    await user.click(screen.getByRole("tab", { name: /^Draft/ }));
    expect(screen.getByText("Modern Physics for JEE Advanced")).toBeInTheDocument();
    expect(screen.queryByText("JEE Physics: Mechanics Masterclass")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Archived/ }));
    expect(screen.getByText("JEE Main 2025 Last-Mile Revision")).toBeInTheDocument();
    expect(screen.queryByText("Modern Physics for JEE Advanced")).not.toBeInTheDocument();
  });
});

describe("Activation request review", () => {
  it("lists pending requests oldest first", () => {
    renderWithStore(<RequestsPage />, asAdmin("owner"));
    expect(screen.getByRole("tab", { name: /^Pending/ })).toHaveAttribute("aria-selected", "true");
    const names = ["Tanvi Deshmukh", "Meera Joshi", "Diya Sharma"];
    const text = screen.getByRole("table").textContent ?? "";
    const positions = names.map((n) => text.indexOf(n));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("SUB-005 — approving activates the learner with the configured expiry", async () => {
    const onClose = vi.fn();
    const { user } = renderWithStore(<ReviewRequestDialog requestId="r-diya" onClose={onClose} />, asAdmin("owner"));
    const dialog = screen.getByRole("dialog", { name: "Review activation request" });
    expect(within(dialog).getByText("Diya Sharma")).toBeInTheDocument();
    expect(within(dialog).getByText("No subscription yet")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^Approve/ }));
    expect(within(dialog).getByText(/Approval is simulated/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Confirm approval/ }));

    expect(getState().requests.find((r) => r.id === "r-diya")).toMatchObject({ status: "approved", approvedDays: 90, reviewedBy: ADMINS.owner });
    expect(getState().periods.find((p) => p.learnerId === LEARNERS.learnerPending)?.expiresAt).toBe(FIXED_NOW + 90 * DAY);
    expect(onClose).toHaveBeenCalled();
  });

  it("SUB-006 — rejecting requires a clear reason that the learner will see", async () => {
    const { user } = renderWithStore(<ReviewRequestDialog requestId="r-diya" onClose={() => undefined} />, asAdmin("owner"));
    await user.click(screen.getByRole("button", { name: /^Reject/ }));
    const reason = screen.getByLabelText(/Reason shown to the learner/);

    await user.type(reason, "Bad ref");
    await user.click(screen.getByRole("button", { name: /Confirm rejection/ }));
    expect(reason).toHaveAccessibleDescription("Give the learner a clear reason (at least 10 characters).");
    expect(getState().requests.find((r) => r.id === "r-diya")?.status).toBe("pending");

    await user.clear(reason);
    await user.type(reason, "Reference not found in our statement.");
    await user.click(screen.getByRole("button", { name: /Confirm rejection/ }));
    expect(getState().requests.find((r) => r.id === "r-diya")).toMatchObject({ status: "rejected", rejectionReason: "Reference not found in our statement." });
  });

  it("ADMIN-014 — an admin without the subscriptions permission can view but not decide", () => {
    const state = createTestState({ admin: "staffCourseManager" }, (s) => {
      s.admins = s.admins.map((a) => (a.id === ADMINS.staffCourseManager ? { ...a, permissions: ["courses", "tests"] } : a));
    });
    renderWithStore(<ReviewRequestDialog requestId="r-diya" onClose={() => undefined} />, { state });
    expect(screen.queryByRole("button", { name: /^Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Reject/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});

describe("ADMIN-015 — admin list loading, empty and error states", () => {
  it("shows a loader while data is delayed, then the list", async () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    const state = createTestState({ admin: "owner" }, (s) => (s.prefs.simulateLatency = true));
    renderWithStore(<CoursesAdminPage />, { state });
    expect(screen.queryByText("JEE Physics: Mechanics Masterclass")).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(screen.getByText("JEE Physics: Mechanics Masterclass")).toBeInTheDocument();
  });

  it("shows a recoverable error", async () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    const state = createTestState({ admin: "owner" }, (s) => (s.prefs.simulateError = true));
    const { user } = renderWithStore(<CoursesAdminPage />, { state });
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    await user.click(screen.getByRole("button", { name: /Try again/ }));
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(screen.getByText("JEE Physics: Mechanics Masterclass")).toBeInTheDocument();
  });

  it("shows a helpful empty state for a filter with no results", async () => {
    const { user } = renderWithStore(<CoursesAdminPage />, asAdmin("owner"));
    await user.type(screen.getByRole("textbox", { name: "Search courses" }), "zzz-no-match");
    expect(screen.getByText("No courses here")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /New course/ }).length).toBeGreaterThan(0);
  });
});
