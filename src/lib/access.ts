import type { AppState } from "./mock/seed";
import type {
  Admin,
  Attempt,
  Course,
  Lesson,
  Permission,
  SubscriptionPeriod,
  SubscriptionRequest,
  SubscriptionStatus,
  Test,
} from "./types";
import { daysUntil } from "./utils";

/* ------------------------- Subscription ------------------------- */

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  /** latest expiry across periods (active or past) */
  expiresAt?: number;
  startedAt?: number;
  daysLeft: number;
  /** total days in the current running window, for progress bars */
  windowDays: number;
  periods: SubscriptionPeriod[];
  requests: SubscriptionRequest[];
  pending?: SubscriptionRequest;
  lastRejected?: SubscriptionRequest;
}

export function getSubscription(state: AppState, learnerId: string | null | undefined, now: number): SubscriptionInfo {
  if (!learnerId) return { status: "none", daysLeft: 0, windowDays: 0, periods: [], requests: [] };
  const periods = state.periods
    .filter((p) => p.learnerId === learnerId)
    .sort((a, b) => a.startsAt - b.startsAt);
  const requests = state.requests
    .filter((r) => r.learnerId === learnerId)
    .sort((a, b) => b.submittedAt - a.submittedAt);
  const pending = requests.find((r) => r.status === "pending");
  const latest = requests[0];
  const lastRejected = latest?.status === "rejected" ? latest : undefined;

  if (periods.length === 0) return { status: "none", daysLeft: 0, windowDays: 0, periods, requests, pending, lastRejected };

  const expiresAt = Math.max(...periods.map((p) => p.expiresAt));
  const running = periods.filter((p) => p.expiresAt > now);
  if (running.length > 0) {
    const startedAt = Math.min(...running.map((p) => Math.min(p.startsAt, p.activatedAt)));
    const windowDays = Math.max(1, Math.round((expiresAt - startedAt) / 86_400_000));
    return { status: "active", expiresAt, startedAt, daysLeft: daysUntil(expiresAt, now), windowDays, periods, requests, pending, lastRejected };
  }
  return { status: "expired", expiresAt, daysLeft: 0, windowDays: 0, periods, requests, pending, lastRejected };
}

/** Learner-facing status label combining the subscription and any pending request */
export function subscriptionLabel(info: SubscriptionInfo): { label: string; tone: "green" | "amber" | "red" | "slate" } {
  if (info.status === "active") return { label: "Active", tone: "green" };
  if (info.pending) return { label: "Pending approval", tone: "amber" };
  if (info.status === "expired") return { label: "Expired", tone: "red" };
  return { label: "Not subscribed", tone: "slate" };
}

/* --------------------------- Courses --------------------------- */

export function allLessons(course: Course): Lesson[] {
  return course.modules.flatMap((m) => m.lessons);
}

export function courseStats(course: Course) {
  const lessons = allLessons(course);
  return {
    lessonCount: lessons.length,
    moduleCount: course.modules.length,
    totalSec: lessons.reduce((a, l) => a + l.durationSec, 0),
    preview: lessons.find((l) => l.isPreview),
  };
}

export function canWatchLesson(lesson: Lesson, sub: SubscriptionInfo): boolean {
  return lesson.isPreview || sub.status === "active";
}

export function courseProgress(state: AppState, learnerId: string | null | undefined, course: Course) {
  const lessons = allLessons(course);
  if (!learnerId) return { completed: 0, total: lessons.length, percent: 0, last: undefined, resumeLesson: undefined, started: false };
  const entries = state.progress.filter((p) => p.learnerId === learnerId && p.courseId === course.id);
  const lessonIds = new Set(lessons.map((l) => l.id));
  const completed = entries.filter((p) => p.completed && lessonIds.has(p.lessonId)).length;
  const last = entries.filter((p) => lessonIds.has(p.lessonId)).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  let resumeLesson: Lesson | undefined;
  if (last) {
    const idx = lessons.findIndex((l) => l.id === last.lessonId);
    resumeLesson = last.completed && idx < lessons.length - 1 ? lessons[idx + 1] : lessons[idx];
  }
  return {
    completed,
    total: lessons.length,
    percent: lessons.length ? Math.round((completed / lessons.length) * 100) : 0,
    last,
    resumeLesson,
    started: entries.length > 0,
  };
}

export const publishedCourses = (state: AppState) => state.courses.filter((c) => c.status === "published");

/* ---------------------------- Tests ---------------------------- */

export type TestAccess =
  | { allowed: true; reason: "demo" | "subscribed" }
  | { allowed: false; reason: "login" | "subscribe" | "limit" | "unpublished" };

export function testAccess(test: Test, learnerId: string | null, sub: SubscriptionInfo, attemptsUsed: number): TestAccess {
  if (!test.published) return { allowed: false, reason: "unpublished" };
  if (test.isDemo) return { allowed: true, reason: "demo" };
  if (!learnerId) return { allowed: false, reason: "login" };
  if (sub.status !== "active") return { allowed: false, reason: "subscribe" };
  if (test.attemptLimit !== null && attemptsUsed >= test.attemptLimit) return { allowed: false, reason: "limit" };
  return { allowed: true, reason: "subscribed" };
}

export function attemptsFor(state: AppState, testId: string, learnerId: string | null | undefined): Attempt[] {
  if (!learnerId) return [];
  return state.attempts
    .filter((a) => a.testId === testId && a.learnerId === learnerId)
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

export function bestAttempt(attempts: Attempt[]): Attempt | undefined {
  return attempts.reduce<Attempt | undefined>((best, a) => (!best || a.result.score > best.result.score ? a : best), undefined);
}

export const demoTest = (state: AppState) => state.tests.find((t) => t.isDemo && t.published);
export const publishedTests = (state: AppState) => state.tests.filter((t) => t.published);

/* ---------------------------- Admin ---------------------------- */

export function hasPermission(admin: Admin | undefined, perm: Permission): boolean {
  if (!admin) return false;
  return admin.role === "owner" || admin.permissions.includes(perm);
}

export const PERMISSION_LABEL: Record<Permission, string> = {
  courses: "Courses & lessons",
  tests: "Tests & questions",
  learners: "Learner records",
  subscriptions: "Subscription requests",
  pricing: "Plan pricing",
};

export const PERMISSION_HINT: Record<Permission, string> = {
  courses: "Create, edit, publish and archive courses, modules and lessons.",
  tests: "Build tests, sections and questions; publish tests and release solutions.",
  learners: "View the learner directory and learner details.",
  subscriptions: "Approve or reject activation requests and activate subscriptions.",
  pricing: "Change prices for the 30, 90 and 365-day durations.",
};
