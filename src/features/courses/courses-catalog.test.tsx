import { act, cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestState } from "@/test/fixtures/state";
import { FIXED_NOW, SECOND } from "@/test/fixtures/time";
import { setNavigation } from "@/test/mocks/next-navigation";
import { renderWithStore } from "@/test/render";
import { CoursesCatalog } from "./courses-catalog";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const courseTitles = () => screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW });
  setNavigation({ path: "/courses" });
});

afterEach(async () => {
  cleanup();
  await vi.advanceTimersByTimeAsync(5 * SECOND);
});

describe("CoursesCatalog", () => {
  it("PUB-003 — lists published courses only", () => {
    renderWithStore(<CoursesCatalog />);
    const titles = courseTitles();
    expect(titles).toHaveLength(8);
    expect(titles).toContain("JEE Physics: Mechanics Masterclass");
    expect(titles).not.toContain("Modern Physics for JEE Advanced"); // draft
    expect(titles).not.toContain("JEE Main 2025 Last-Mile Revision"); // archived
    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 8 courses");
  });

  it("filters by search text and restores the list when cleared", async () => {
    const { user } = renderWithStore(<CoursesCatalog />);
    await user.type(screen.getByRole("textbox", { name: "Search courses" }), "organic");
    // matches "Organic Chemistry…" and "Inorganic Chemistry"
    expect(courseTitles()).toHaveLength(2);
    expect(courseTitles().every((t) => /organic/i.test(t ?? ""))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(courseTitles()).toHaveLength(8);
  });

  it("STATE-001 — shows a loader (not an empty state) while data is delayed", async () => {
    const state = createTestState({}, (s) => (s.prefs.simulateLatency = true));
    renderWithStore(<CoursesCatalog />, { state });

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.getByText("Loading courses…")).toBeInTheDocument();
    expect(screen.queryByText("No courses match your filters")).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(screen.queryByRole("status", { name: "Loading" })).not.toBeInTheDocument();
    expect(courseTitles()).toHaveLength(8);
  });

  it("STATE-004 — a simulated error is recoverable with Try again, without technical details", async () => {
    const state = createTestState({}, (s) => (s.prefs.simulateError = true));
    const { user } = renderWithStore(<CoursesCatalog />, { state });
    await act(() => vi.advanceTimersByTimeAsync(10));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load courses");
    expect(alert).not.toHaveTextContent(/stack|exception|TypeError|undefined/i);

    await user.click(screen.getByRole("button", { name: /Try again/ }));
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(courseTitles()).toHaveLength(8);
  });

  it("STATE-002 — an empty catalog shows a helpful empty state", () => {
    const state = createTestState({}, (s) => (s.courses = s.courses.filter((c) => c.status !== "published")));
    renderWithStore(<CoursesCatalog />, { state });
    expect(screen.getByText("No courses match your filters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("filters by exam from the URL", () => {
    setNavigation({ path: "/courses", search: "exam=mht-cet" });
    renderWithStore(<CoursesCatalog />);
    expect(screen.getByText(/Showing/)).toHaveTextContent(/for MHT-CET/);
    expect(courseTitles().length).toBeLessThan(8);
  });
});
