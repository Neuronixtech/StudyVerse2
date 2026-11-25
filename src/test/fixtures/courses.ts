import type { Course, CourseModule, Lesson, LessonProgress } from "@/lib/types";
import { FIXED_NOW } from "./time";

export function makeLesson(id: string, overrides: Partial<Lesson> = {}): Lesson {
  return {
    id,
    title: `Lesson ${id}`,
    description: `About ${id}`,
    durationSec: 600,
    isPreview: false,
    video: { kind: "upload", ref: `${id}.mp4` },
    ...overrides,
  };
}

export function makeModule(id: string, title: string, lessons: Lesson[]): CourseModule {
  return { id, title, lessons };
}

/**
 * A published course with two ordered modules and five lessons:
 *   Module 1 "Foundations": l1 (free preview), l2, l3
 *   Module 2 "Applications": l4, l5
 */
export function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: "c-fixture",
    slug: "fixture-course",
    title: "Fixture Course",
    subtitle: "A deterministic course for automated tests",
    description: "Course used by the automated suite.",
    theme: "teal",
    subjectIds: ["physics"],
    examIds: ["jee-main"],
    level: "Intermediate",
    instructor: { name: "Test Instructor", title: "Faculty" },
    status: "published",
    featured: false,
    highlights: ["Highlight one"],
    modules: [
      makeModule("m1", "Foundations", [
        makeLesson("l1", { title: "Welcome and overview", isPreview: true }),
        makeLesson("l2", { title: "Core concepts" }),
        makeLesson("l3", { title: "Worked examples" }),
      ]),
      makeModule("m2", "Applications", [makeLesson("l4", { title: "Problem solving" }), makeLesson("l5", { title: "Final recap" })]),
    ],
    rating: 4.5,
    ratingCount: 10,
    enrolled: 100,
    createdAt: FIXED_NOW - 90 * 86_400_000,
    updatedAt: FIXED_NOW - 5 * 86_400_000,
    ...overrides,
  };
}

export function makeProgress(learnerId: string, lessonId: string, overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    learnerId,
    courseId: "c-fixture",
    lessonId,
    positionSec: 0,
    completed: false,
    updatedAt: FIXED_NOW - 86_400_000,
    ...overrides,
  };
}
