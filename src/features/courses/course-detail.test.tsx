import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/lib/types";
import { makeCourse, makeProgress } from "@/test/fixtures/courses";
import { createTestState, type TestStateOptions } from "@/test/fixtures/state";
import { FIXED_NOW } from "@/test/fixtures/time";
import { LEARNERS } from "@/test/fixtures/users";
import { router } from "@/test/mocks/next-navigation";
import { renderWithStore } from "@/test/render";
import { CourseDetail } from "./course-detail";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

function renderCourse(session: TestStateOptions = {}, course: Course = makeCourse(), progress: ReturnType<typeof makeProgress>[] = []) {
  const state = createTestState(session, (s) => {
    s.courses.push(course);
    s.progress.push(...progress);
  });
  return renderWithStore(<CourseDetail slug={course.slug} />, { state });
}

const content = () => screen.getByRole("region", { name: "Course content" });
const lessonButton = (name: RegExp) => within(content()).getByRole("button", { name });

beforeEach(() => vi.setSystemTime(FIXED_NOW));

describe("CourseDetail — public view", () => {
  it("PUB-004 / PUB-005 — a visitor sees the course details without signing in", () => {
    renderCourse();
    expect(screen.getByRole("heading", { level: 1, name: "Fixture Course" })).toBeInTheDocument();
    expect(screen.getByText("A deterministic course for automated tests")).toBeInTheDocument();
    expect(screen.getByText("Course used by the automated suite.")).toBeInTheDocument();
    expect(screen.getAllByText("JEE Main").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Physics").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 modules · 5 lessons").length).toBeGreaterThan(0);
    expect(screen.getByText("Sign in to unlock all lessons")).toBeInTheDocument();
  });

  it("COURSE-001 — modules and lessons appear in their configured order", async () => {
    const { user } = renderCourse();
    // first two modules are expanded by default
    const modules = within(content()).getAllByRole("button", { expanded: true }).map((b) => b.textContent);
    expect(modules[0]).toMatch(/^1Foundations/);
    expect(modules[1]).toMatch(/^2Applications/);

    const lessons = within(content())
      .getAllByRole("listitem")
      .map((li) => li.textContent?.replace(/^Locked: /, "").replace(/(Free preview)?\d+:\d{2}$/, ""));
    expect(lessons).toEqual(["Welcome and overview", "Core concepts", "Worked examples", "Problem solving", "Final recap"]);

    await user.click(within(content()).getByRole("button", { name: /Foundations/ }));
    expect(within(content()).getByRole("button", { name: /Foundations/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("COURSE-005 — the single preview lesson is marked, and paid lessons are announced as locked", () => {
    renderCourse({ learner: "learnerNoSubscription" });
    expect(within(content()).getAllByText("Free preview")).toHaveLength(1);
    expect(lessonButton(/Welcome and overview/)).toHaveAccessibleName(/^Welcome and overview/);
    expect(lessonButton(/Core concepts/)).toHaveAccessibleName(/^Locked:\s*Core concepts/);
  });

  it("SUB-008 — a locked lesson opens an explanation with a subscription CTA instead of the player", async () => {
    const { user } = renderCourse({ learner: "learnerNoSubscription" });
    await user.click(lessonButton(/Core concepts/));

    const dialog = screen.getByRole("dialog", { name: "This lesson is locked" });
    expect(within(dialog).getByText("Subscribe to unlock this lesson")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /View plans/ })).toHaveAttribute("href", "/subscribe");
    expect(within(dialog).getByRole("link", { name: "Welcome and overview" })).toHaveAttribute("href", "/learn/fixture-course/l1");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("the preview lesson opens the player for anyone", async () => {
    const { user } = renderCourse();
    await user.click(lessonButton(/Welcome and overview/));
    expect(router.push).toHaveBeenCalledWith("/learn/fixture-course/l1");
  });

  it("SUB-004 — a pending learner is told the request is awaiting approval", () => {
    renderCourse({ learner: "learnerPending" });
    expect(screen.getByText("Activation request pending")).toBeInTheDocument();
  });

  it("SUB-010 — an expired learner is asked to renew", () => {
    renderCourse({ learner: "learnerExpired" });
    expect(screen.getByText(/Your subscription expired on/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Renew subscription/ })).toHaveAttribute("href", "/subscribe");
  });
});

describe("CourseDetail — subscribed learner", () => {
  const ME = LEARNERS.learnerActive;

  it("SUB-009 — paid lessons open the player", async () => {
    const { user } = renderCourse({ learner: "learnerActive" });
    expect(screen.getByText("Included in your subscription")).toBeInTheDocument();
    await user.click(lessonButton(/Core concepts/));
    expect(router.push).toHaveBeenCalledWith("/learn/fixture-course/l2");
  });

  it("COURSE-009 / COURSE-010 — progress summary and completed lessons", () => {
    renderCourse({ learner: "learnerActive" }, makeCourse(), [
      makeProgress(ME, "l1", { completed: true, updatedAt: FIXED_NOW - 2000 }),
      makeProgress(ME, "l2", { completed: true, updatedAt: FIXED_NOW - 1000 }),
    ]);
    expect(screen.getByText("2 of 5 lessons watched")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Course progress" })).toHaveAttribute("aria-valuenow", "40");
    expect(lessonButton(/Core concepts/)).toHaveAccessibleName(/^Completed:\s*Core concepts/);
    expect(lessonButton(/Worked examples/)).toHaveAccessibleName(/^Worked examples/);
    expect(screen.getByRole("link", { name: /Continue learning/ })).toHaveAttribute("href", "/learn/fixture-course/l3");
  });

  it("offers Start learning before any progress", () => {
    renderCourse({ learner: "learnerActive" });
    expect(screen.getByRole("link", { name: /Start learning/ })).toHaveAttribute("href", "/learn/fixture-course/l1");
  });
});

describe("CourseDetail — unavailable courses", () => {
  it("PUB-006 — an archived course is not presented as published", () => {
    renderCourse({}, makeCourse({ status: "archived" }));
    expect(screen.getByText("This course has been archived")).toBeInTheDocument();
    expect(screen.queryByText("Course content")).not.toBeInTheDocument();
  });

  it("a draft course is not found publicly", () => {
    renderCourse({}, makeCourse({ status: "draft" }));
    expect(screen.getByText("Course not found")).toBeInTheDocument();
  });

  it("STATE-006 — an unknown slug shows a navigable not-found state", () => {
    renderWithStore(<CourseDetail slug="no-such-course" />);
    expect(screen.getByText("Course not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse courses" })).toHaveAttribute("href", "/courses");
  });
});
