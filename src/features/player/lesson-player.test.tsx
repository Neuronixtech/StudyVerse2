import { act, cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getState } from "@/lib/store";
import { makeCourse, makeProgress } from "@/test/fixtures/courses";
import { createTestState, type TestStateOptions } from "@/test/fixtures/state";
import { FIXED_NOW, SECOND } from "@/test/fixtures/time";
import { LEARNERS } from "@/test/fixtures/users";
import { router } from "@/test/mocks/next-navigation";
import { advance, renderWithStore } from "@/test/render";
import { LessonPlayer } from "./lesson-player";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const ME = LEARNERS.learnerActive;

function renderLesson(lessonId: string, session: TestStateOptions = { learner: "learnerActive" }, progress: ReturnType<typeof makeProgress>[] = []) {
  const state = createTestState(session, (s) => {
    s.courses.push(makeCourse());
    s.progress.push(...progress);
  });
  return renderWithStore(<LessonPlayer slug="fixture-course" lessonId={lessonId} />, { state });
}

const player = () => screen.queryByRole("region", { name: /^Video player/ });
const myProgress = (lessonId: string) => getState().progress.find((p) => p.learnerId === ME && p.lessonId === lessonId);

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW });
});

afterEach(async () => {
  cleanup();
  await vi.advanceTimersByTimeAsync(5 * SECOND);
});

describe("LessonPlayer — access", () => {
  it("VID-001 — renders the player with lesson title and course/module context", () => {
    renderLesson("l2");
    expect(player()).toHaveAccessibleName("Video player: Core concepts");
    expect(screen.getByRole("heading", { level: 1, name: "Core concepts" })).toBeInTheDocument();
    expect(screen.getByText("Foundations · Lesson 2 of 5")).toBeInTheDocument();
    expect(screen.getByText(/Simulated player · no real video/)).toBeInTheDocument();
  });

  it("VID-007 — a locked lesson shows the lock explanation and no playback controls", () => {
    renderLesson("l2", { learner: "learnerNoSubscription" });
    expect(player()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Play/ })).not.toBeInTheDocument();
    expect(screen.getByText("This lesson is part of the subscription")).toBeInTheDocument();
    expect(screen.getByText("Subscribe to unlock this lesson")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark as complete/ })).not.toBeInTheDocument();
  });

  it("the free preview plays for a visitor, who is invited to sign in to track progress", () => {
    renderLesson("l1", {});
    expect(player()).toBeInTheDocument();
    expect(screen.getAllByText("Free preview").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Sign in to track progress" })).toHaveAttribute("href", "/login?next=/learn/fixture-course/l1");
  });

  it("marks locked lessons in the contents list for screen readers", () => {
    renderLesson("l1", { learner: "learnerNoSubscription" });
    const outline = screen.getByRole("complementary", { name: "Course contents" });
    expect(outline).toHaveTextContent(/Locked:\s*Core concepts/);
  });

  it("STATE-006 — an unknown lesson shows a not-found state with a way back", () => {
    renderLesson("nope");
    expect(screen.getByText("Lesson not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to course" })).toHaveAttribute("href", "/courses/fixture-course");
  });
});

describe("LessonPlayer — navigation", () => {
  it("COURSE-006 — Next opens the following lesson, across module boundaries", async () => {
    const { user } = renderLesson("l3");
    await user.click(screen.getByRole("button", { name: /^Next:\s*Problem solving$/ }));
    expect(router.push).toHaveBeenCalledWith("/learn/fixture-course/l4");
  });

  it("COURSE-007 — Previous opens the preceding lesson", async () => {
    const { user } = renderLesson("l3");
    await user.click(screen.getByRole("button", { name: /^Previous:\s*Core concepts$/ }));
    expect(router.push).toHaveBeenCalledWith("/learn/fixture-course/l2");
  });

  it("COURSE-008 — Previous is disabled on the first lesson and Next on the last", () => {
    renderLesson("l1");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    cleanup();
    renderLesson("l5");
    expect(screen.getByRole("button", { name: "Last lesson" })).toBeDisabled();
  });

  it("the current lesson is highlighted in the contents list", () => {
    renderLesson("l2");
    expect(screen.getByRole("button", { current: true })).toHaveTextContent("Core concepts");
  });
});

describe("LessonPlayer — simulated playback and progress", () => {
  it("VID-002 — play, pause and seek update the displayed position", async () => {
    const { user } = renderLesson("l2");
    await user.click(screen.getByRole("button", { name: "Play lesson" }));
    await advance(2 * SECOND);
    expect(screen.getByText("0:02 / 10:00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pause" }));
    await advance(3 * SECOND);
    expect(screen.getByText("0:02 / 10:00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Forward 10 seconds" }));
    expect(screen.getByText("0:12 / 10:00")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuetext", "0:12 of 10:00");
  });

  it("VID-003 — offers to resume from the saved position", async () => {
    const { user } = renderLesson("l2", undefined, [makeProgress(ME, "l2", { positionSec: 120 })]);
    expect(screen.getByText("Pick up where you left off?")).toBeInTheDocument();
    expect(screen.getByText("You stopped at 2:00 of 10:00.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume from 2:00" }));
    expect(screen.getByText("2:00 / 10:00")).toBeInTheDocument();
  });

  it("VID-003 — a saved position at the very end is not offered for resume", () => {
    renderLesson("l2", undefined, [makeProgress(ME, "l2", { positionSec: 590 })]);
    expect(screen.queryByText("Pick up where you left off?")).not.toBeInTheDocument();
    expect(screen.getByText("0:00 / 10:00")).toBeInTheDocument();
  });

  it("VID-004 — watching to 90% saves progress and completes the lesson", async () => {
    const { user } = renderLesson("l2");
    await user.selectOptions(screen.getByLabelText("Playback speed"), "20");
    await user.click(screen.getByRole("button", { name: "Play lesson" }));
    await advance(28 * SECOND); // 28s × 20 = 560s ≥ 90% of 600s

    expect(myProgress("l2")).toMatchObject({ completed: true });
    expect(myProgress("l2")!.positionSec).toBeGreaterThanOrEqual(540);
    expect(screen.getByText("1/5 completed")).toBeInTheDocument();
  });

  it("VID-005 — Mark as complete updates the lesson and the course summary", async () => {
    const { user } = renderLesson("l2");
    const toggle = screen.getByRole("button", { name: /Mark as complete/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Completed" })).toHaveAttribute("aria-pressed", "true");
    expect(myProgress("l2")?.completed).toBe(true);
    expect(screen.getByText("1/5 completed")).toBeInTheDocument();
    expect(screen.getByText("Lesson marked as complete")).toBeInTheDocument();
  });

  it("VID-006 — a completed lesson can be reopened and stays complete", () => {
    renderLesson("l2", undefined, [makeProgress(ME, "l2", { completed: true, positionSec: 600 })]);
    expect(player()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Completed" })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves the position when leaving the lesson", async () => {
    const { user, unmount } = renderLesson("l2");
    await user.click(screen.getByRole("button", { name: "Play lesson" }));
    await advance(4 * SECOND);
    act(() => unmount());
    expect(myProgress("l2")).toMatchObject({ positionSec: 4, completed: false });
  });
});

describe("LessonPlayer — media errors (VID-008)", () => {
  it("VID-008 — a failed video load shows a useful error with Try again and a way back, without crashing", async () => {
    const state = createTestState({ learner: "learnerActive" }, (s) => {
      s.courses.push(makeCourse());
      s.prefs.simulateError = true;
    });
    const { user } = renderWithStore(<LessonPlayer slug="fixture-course" lessonId="l2" />, { state });
    await advance(10);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This video couldn't load");
    expect(alert).toHaveTextContent("Your progress so far is saved");
    expect(player()).not.toBeInTheDocument();
    // the rest of the page still works: title, navigation and the back link stay available
    expect(screen.getByRole("heading", { level: 1, name: "Core concepts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to course page" })).toHaveAttribute("href", "/courses/fixture-course");

    await user.click(screen.getByRole("button", { name: /Try again/ }));
    await advance(10);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(player()).toBeInTheDocument();
  });

  it("VID-008 — shows a loading state while the video is slow to load", async () => {
    const state = createTestState({ learner: "learnerActive" }, (s) => {
      s.courses.push(makeCourse());
      s.prefs.simulateLatency = true;
    });
    renderWithStore(<LessonPlayer slug="fixture-course" lessonId="l2" />, { state });
    expect(screen.getByRole("status", { name: "Loading video" })).toBeInTheDocument();
    expect(player()).not.toBeInTheDocument();
    await advance(1200);
    expect(player()).toBeInTheDocument();
  });

  it("VID-008 — a locked lesson shows the lock, never a media error", async () => {
    const state = createTestState({ learner: "learnerNoSubscription" }, (s) => {
      s.courses.push(makeCourse());
      s.prefs.simulateError = true;
    });
    renderWithStore(<LessonPlayer slug="fixture-course" lessonId="l2" />, { state });
    await advance(10);
    expect(screen.getByText("Subscribe to unlock this lesson")).toBeInTheDocument();
    expect(screen.queryByText("This video couldn't load")).not.toBeInTheDocument();
  });
});
