import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { allLessons, publishedCourses } from "@/lib/access";
import { getState } from "@/lib/store";
import type { Course } from "@/lib/types";
import { makeCourse } from "@/test/fixtures/courses";
import { makeTest } from "@/test/fixtures/exams";
import { createTestState } from "@/test/fixtures/state";
import { FIXED_NOW } from "@/test/fixtures/time";
import { router } from "@/test/mocks/next-navigation";
import { renderWithStore } from "@/test/render";
import { CourseCreatePage, CourseEditorPage } from "./admin-courses";
import { TestCreatePage, TestEditorPage } from "./admin-tests";

vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));

const asOwner = (mutate?: Parameters<typeof createTestState>[1]) => ({ state: createTestState({ admin: "owner" }, mutate) });
const course = (id: string) => getState().courses.find((c) => c.id === id)!;
const lessonTitles = (c: Course) => c.modules.map((m) => [m.title, m.lessons.map((l) => l.title)]);

beforeEach(() => vi.setSystemTime(FIXED_NOW));

describe("Course creation", () => {
  it("ADMIN-003 — required fields are validated and nothing is created", async () => {
    const { user } = renderWithStore(<CourseCreatePage />, asOwner());
    const before = getState().courses.length;
    await user.click(screen.getByRole("button", { name: "Create draft" }));

    expect(screen.getByLabelText(/Course title/)).toHaveAccessibleDescription("Title must be at least 5 characters");
    expect(screen.getByLabelText(/Subtitle/)).toHaveAccessibleDescription("Add a one-line summary");
    expect(screen.getByText("Choose at least one subject")).toBeInTheDocument();
    expect(screen.getByLabelText(/Instructor name/)).toHaveAccessibleDescription("Add the instructor's name");
    expect(getState().courses).toHaveLength(before);
  });

  it("ADMIN-003 — a title that collides with an existing course URL is rejected", async () => {
    const { user } = renderWithStore(<CourseCreatePage />, asOwner());
    await user.type(screen.getByLabelText(/Course title/), "JEE Physics: Mechanics");
    await user.click(screen.getByRole("button", { name: "Create draft" }));
    expect(screen.getByLabelText(/Course title/)).toHaveAccessibleDescription("A course with a similar title already exists");
  });

  it("ADMIN-002 — a valid course is saved as a hidden draft and opens in the editor", async () => {
    const { user } = renderWithStore(<CourseCreatePage />, asOwner());
    await user.type(screen.getByLabelText(/Course title/), "Rotational Mechanics for JEE");
    expect(screen.getByText("URL: /courses/rotational-mechanics-for-jee")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Subtitle/), "Torque, angular momentum and rolling");
    await user.click(screen.getByRole("button", { name: "Physics" }));
    await user.type(screen.getByLabelText(/Instructor name/), "Dr. Test");
    await user.click(screen.getByRole("button", { name: "Create draft" }));

    const created = getState().courses.find((c) => c.slug === "rotational-mechanics-for-jee")!;
    expect(created).toMatchObject({ status: "draft", subjectIds: ["physics"], instructor: { name: "Dr. Test", title: "Faculty" } });
    expect(publishedCourses(getState()).map((c) => c.id)).not.toContain(created.id);
    expect(router.push).toHaveBeenCalledWith(`/admin/courses/${created.id}`);
  });
});

describe("Course curriculum editor", () => {
  const renderEditor = () => renderWithStore(<CourseEditorPage courseId="c-fixture" />, asOwner((s) => s.courses.push(makeCourse({ status: "draft" }))));

  it("ADMIN-004 — modules can be added and reordered, and the order is saved", async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole("tab", { name: /Curriculum/ }));
    await user.click(screen.getByRole("button", { name: /Add module/ }));
    const titles = () => screen.getAllByRole("textbox", { name: /^Module \d title$/ }).map((i) => (i as HTMLInputElement).value);
    expect(titles()).toHaveLength(3);

    await user.click(screen.getAllByRole("button", { name: "Move module up" })[1]); // Applications ↑
    expect(titles().slice(0, 2)).toEqual(["Applications", "Foundations"]);
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(course("c-fixture").modules.map((m) => m.title).slice(0, 2)).toEqual(["Applications", "Foundations"]);
  });

  it("ADMIN-005 — lessons can be added and reordered within their module", async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole("tab", { name: /Curriculum/ }));

    // add a lesson (external URL avoids the simulated upload) to module 2
    await user.click(screen.getAllByRole("button", { name: /Add lesson/ })[1]);
    const dialog = screen.getByRole("dialog", { name: "Add lesson" });
    await user.type(within(dialog).getByLabelText(/Lesson title/), "Bonus practice");
    await user.type(within(dialog).getByRole("textbox", { name: "Minutes" }), "12");
    await user.click(within(dialog).getByRole("radio", { name: /External URL/ }));
    await user.type(within(dialog).getByRole("textbox", { name: "Video URL" }), "https://videos.example.com/bonus");
    await user.click(within(dialog).getByRole("button", { name: "Add lesson" }));

    // move "Worked examples" (module 1, lesson 3) up one place; buttons are listed per lesson, first one disabled
    await user.click(screen.getAllByRole("button", { name: "Move lesson up" })[2]);
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    expect(lessonTitles(course("c-fixture"))).toEqual([
      ["Foundations", ["Welcome and overview", "Worked examples", "Core concepts"]],
      ["Applications", ["Problem solving", "Final recap", "Bonus practice"]],
    ]);
    expect(allLessons(course("c-fixture")).find((l) => l.title === "Bonus practice")).toMatchObject({ durationSec: 720, video: { kind: "url" } });
  });

  it("ADMIN-005 — the lesson dialog validates title, duration and video source", async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole("tab", { name: /Curriculum/ }));
    await user.click(screen.getAllByRole("button", { name: /Add lesson/ })[0]);
    const dialog = screen.getByRole("dialog", { name: "Add lesson" });
    expect(within(dialog).getAllByText("Choose a video file")).toHaveLength(1); // the upload prompt
    await user.click(within(dialog).getByRole("button", { name: "Add lesson" }));
    expect(within(dialog).getByLabelText(/Lesson title/)).toHaveAccessibleDescription("Enter a lesson title");
    expect(within(dialog).getAllByText("Choose a video file")).toHaveLength(2); // prompt + validation error
  });

  it("ADMIN-006 — marking another lesson as preview replaces the existing one (one per course)", async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole("tab", { name: /Curriculum/ }));
    expect(screen.getByText("Free preview: “Welcome and overview”")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Edit lesson" })[3]); // Problem solving
    const dialog = screen.getByRole("dialog", { name: "Edit lesson" });
    await user.click(within(dialog).getByRole("switch", { name: "Free preview lesson" }));
    expect(within(dialog).getByText(/This replaces “Welcome and overview” as the course's free preview/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Update lesson" }));
    await user.click(screen.getByRole("button", { name: /Save changes/ }));

    const previews = allLessons(course("c-fixture")).filter((l) => l.isPreview);
    expect(previews.map((l) => l.title)).toEqual(["Problem solving"]);
  });

  it("ADMIN-006 / ADMIN-007 — publishing is blocked until exactly one preview exists", async () => {
    const noPreview = makeCourse({ status: "draft" });
    noPreview.modules[0].lessons[0].isPreview = false;
    const { user } = renderWithStore(<CourseEditorPage courseId="c-fixture" />, asOwner((s) => s.courses.push(noPreview)));

    await user.click(screen.getByRole("button", { name: /^Publish$/ }));
    expect(screen.getByText("Fix these before publishing")).toBeInTheDocument();
    expect(screen.getByText("Mark exactly one lesson as the free preview.")).toBeInTheDocument();
    expect(course("c-fixture").status).toBe("draft");
  });

  it("ADMIN-007 — a complete draft publishes", async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole("button", { name: /^Publish$/ }));
    expect(course("c-fixture").status).toBe("published");
    expect(publishedCourses(getState()).map((c) => c.id)).toContain("c-fixture");
  });
});

describe("Test authoring", () => {
  it("ADMIN-008 — creating a test validates name and subjects, then creates one section per subject", async () => {
    const { user } = renderWithStore(<TestCreatePage />, asOwner());
    await user.click(screen.getByRole("button", { name: "Create test" }));
    expect(screen.getByLabelText(/Test name/)).toHaveAccessibleDescription("Title must be at least 5 characters");
    expect(screen.getByText("Choose at least one subject")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Test name/), "Weekly Mixed Quiz");
    await user.click(screen.getByRole("button", { name: "Physics" }));
    await user.click(screen.getByRole("button", { name: "Mathematics" }));
    await user.click(screen.getByRole("button", { name: "Create test" }));

    const created = getState().tests.find((t) => t.title === "Weekly Mixed Quiz")!;
    expect(created).toMatchObject({ published: false, version: 1 });
    expect(created.sections.map((s) => s.name)).toEqual(["Physics", "Mathematics"]);
    expect(router.push).toHaveBeenCalledWith(`/admin/tests/${created.id}`);
  });

  describe("question editor", () => {
    const empty = makeTest({ id: "t-new", published: false, sections: [{ id: "s1", name: "Physics", durationMin: 10, questions: [] }] });
    const renderTestEditor = () => renderWithStore(<TestEditorPage testId="t-new" />, asOwner((s) => s.tests.push(empty)));
    const openAdd = async (user: ReturnType<typeof renderTestEditor>["user"]) => {
      await user.click(screen.getByRole("tab", { name: /Sections & questions/ }));
      await user.click(screen.getByRole("button", { name: /Add question/ }));
      return screen.getByRole("dialog", { name: "Add question" });
    };

    it("ADMIN-008 — single-correct: needs text, option text and exactly one correct option", async () => {
      const { user } = renderTestEditor();
      const dialog = await openAdd(user);
      await user.click(within(dialog).getByRole("button", { name: "Add question" }));
      expect(within(dialog).getByText("Question text is too short")).toBeInTheDocument();

      await user.type(within(dialog).getByRole("textbox", { name: /^Question/ }), "What is the SI unit of force?");
      for (const [l, text] of [["A", "Newton"], ["B", "Joule"], ["C", "Watt"], ["D", "Pascal"]]) {
        await user.type(within(dialog).getByRole("textbox", { name: `Option ${l} text` }), text);
      }
      await user.click(within(dialog).getByRole("button", { name: "Add question" }));
      expect(within(dialog).getByText("Select exactly one correct option")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("radio", { name: "Option A correct" }));
      await user.click(within(dialog).getByRole("button", { name: "Add question" }));
      const q = getState().tests.find((t) => t.id === "t-new")!;
      // saved to the draft only — the store still has none until the test is saved
      expect(q.sections[0].questions).toHaveLength(0);
      await user.click(screen.getByRole("button", { name: /Save changes|Save$/ }));
      const saved = getState().tests.find((t) => t.id === "t-new")!.sections[0].questions[0];
      expect(saved).toMatchObject({ type: "single", text: "What is the SI unit of force?" });
      expect(saved.correctOptionIds).toEqual([saved.options[0].id]);
    });

    it("ADMIN-008 — multi-select allows several correct options", async () => {
      const { user } = renderTestEditor();
      const dialog = await openAdd(user);
      await user.click(within(dialog).getByRole("radio", { name: "Multi-select" }));
      expect(within(dialog).getByText("Options · mark the correct answers")).toBeInTheDocument();
      expect(within(dialog).getByRole("checkbox", { name: "Option A correct" })).toBeInTheDocument();
      await user.click(within(dialog).getByRole("checkbox", { name: "Option A correct" }));
      await user.click(within(dialog).getByRole("checkbox", { name: "Option C correct" }));
      expect(within(dialog).getByRole("checkbox", { name: "Option A correct" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Option C correct" })).toBeChecked();
    });

    it("ADMIN-008 — numerical shows the answer, tolerance and precision editor", async () => {
      const { user } = renderTestEditor();
      const dialog = await openAdd(user);
      await user.click(within(dialog).getByRole("radio", { name: "Numerical" }));
      expect(within(dialog).queryByRole("textbox", { name: "Option A text" })).not.toBeInTheDocument();
      expect(within(dialog).getByLabelText("Correct value")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Tolerance (±)")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Decimal places")).toBeInTheDocument();

      await user.type(within(dialog).getByRole("textbox", { name: /^Question/ }), "Find the value of 2 + 2.");
      await user.click(within(dialog).getByRole("button", { name: "Add question" }));
      expect(within(dialog).getByText("Numerical answer missing")).toBeInTheDocument();
    });
  });

  it("ADMIN-009 — timing, marking and release settings are reflected in the instructions preview", async () => {
    const { user } = renderWithStore(<TestEditorPage testId="t-fixture" />, asOwner((s) => s.tests.push(makeTest({ published: false }))));
    const correct = screen.getByLabelText("Correct");
    await user.clear(correct);
    await user.type(correct, "3");
    await user.clear(screen.getByLabelText("Duration"));
    await user.type(screen.getByLabelText("Duration"), "45");
    await user.click(screen.getByRole("radio", { name: "Release manually" }));

    await user.click(screen.getByRole("tab", { name: /Instructions preview/ }));
    const facts = within(screen.getByText("What learners see before starting").parentElement!)
      .getAllByRole("definition")
      .map((d) => d.textContent);
    expect(facts.slice(0, 4)).toEqual(["45 min", "Overall timer", "4", "12"]);

    await user.click(screen.getByRole("button", { name: /Save changes|Save$/ }));
    expect(getState().tests.find((t) => t.id === "t-fixture")).toMatchObject({ durationMin: 45, defaultMarks: { correct: 3 }, resultRelease: "manual", solutionsReleased: false });
  });

  it("ADMIN-010 — a test with an empty section cannot be published", async () => {
    const invalid = makeTest({ published: false, sections: [...makeTest().sections, { id: "s-empty", name: "Chemistry", durationMin: 0, questions: [] }] });
    const { user } = renderWithStore(<TestEditorPage testId="t-fixture" />, asOwner((s) => s.tests.push(invalid)));
    await user.click(screen.getByRole("button", { name: /^Publish$/ }));
    expect(screen.getByText("“Chemistry” has no questions.")).toBeInTheDocument();
    expect(getState().tests.find((t) => t.id === "t-fixture")?.published).toBe(false);
  });

  it("ADMIN-010 — a valid test publishes", async () => {
    const { user } = renderWithStore(<TestEditorPage testId="t-fixture" />, asOwner((s) => s.tests.push(makeTest({ published: false }))));
    await user.click(screen.getByRole("button", { name: /^Publish$/ }));
    expect(getState().tests.find((t) => t.id === "t-fixture")?.published).toBe(true);
  });

  it("ADMIN-011 — editing a test with attempts explains that a new version will be created", () => {
    renderWithStore(<TestEditorPage testId="t-demo" />, asOwner());
    expect(screen.getByText(/submitted attempts? use this test/)).toBeInTheDocument();
    expect(screen.getByText(/Saving changes creates version v4\. Historical results keep/)).toBeInTheDocument();
  });
});
