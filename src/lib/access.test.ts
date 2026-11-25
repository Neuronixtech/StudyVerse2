import { describe, expect, it } from "vitest";
import {
  attemptsFor,
  bestAttempt,
  canWatchLesson,
  courseProgress,
  courseStats,
  demoTest,
  getSubscription,
  hasPermission,
  publishedCourses,
  publishedTests,
  subscriptionLabel,
  testAccess,
  type SubscriptionInfo,
} from "./access";
import type { SubscriptionPeriod } from "./types";
import { makeCourse, makeLesson, makeProgress } from "@/test/fixtures/courses";
import { makeTest } from "@/test/fixtures/exams";
import { createTestState } from "@/test/fixtures/state";
import { DAY, FIXED_NOW, HOUR } from "@/test/fixtures/time";
import { ADMINS, LEARNERS } from "@/test/fixtures/users";

const state = createTestState();
const subOf = (learnerId: string | null) => getSubscription(state, learnerId, FIXED_NOW);

const period = (id: string, learnerId: string, startsAt: number, days: number): SubscriptionPeriod => ({
  id,
  learnerId,
  days,
  startsAt,
  expiresAt: startsAt + days * DAY,
  activatedAt: startsAt,
  activatedBy: ADMINS.owner,
});

describe("getSubscription — learner access states", () => {
  it("a visitor has no subscription", () => {
    expect(subOf(null)).toMatchObject({ status: "none", daysLeft: 0, periods: [], requests: [] });
  });

  it("learnerNoSubscription: none, with no pending or rejected request", () => {
    const sub = subOf(LEARNERS.learnerNoSubscription);
    expect(sub.status).toBe("none");
    expect(sub.pending).toBeUndefined();
    expect(sub.lastRejected).toBeUndefined();
  });

  it("SUB-004 — learnerPending: still none, but the pending request is exposed", () => {
    const sub = subOf(LEARNERS.learnerPending);
    expect(sub.status).toBe("none");
    expect(sub.pending).toMatchObject({ id: "r-diya", planDays: 90, status: "pending" });
  });

  it("SUB-009 — learnerActive: active with the configured expiry and days left", () => {
    const sub = subOf(LEARNERS.learnerActive);
    expect(sub.status).toBe("active");
    expect(sub.expiresAt).toBe(FIXED_NOW - 26 * DAY + 90 * DAY);
    expect(sub.daysLeft).toBe(64);
    expect(sub.windowDays).toBe(90);
  });

  it("SUB-010 — learnerExpired: expired, keeping the past expiry date", () => {
    const sub = subOf(LEARNERS.learnerExpired);
    expect(sub.status).toBe("expired");
    expect(sub.expiresAt).toBe(FIXED_NOW - 12 * DAY);
    expect(sub.daysLeft).toBe(0);
    expect(sub.periods).toHaveLength(1);
  });

  it("SUB-006 — a rejected latest request is surfaced as lastRejected", () => {
    const sub = subOf(LEARNERS.learnerRejected);
    expect(sub.lastRejected).toMatchObject({ id: "r-karan", status: "rejected" });
    expect(sub.lastRejected?.rejectionReason).toMatch(/UPI reference/);
  });

  it("SUB-007 — a newer pending request supersedes the rejected one", () => {
    const s = createTestState({}, (st) => {
      st.requests.push({ ...st.requests.find((r) => r.id === "r-karan")!, id: "r-karan-2", status: "pending", submittedAt: FIXED_NOW - HOUR, rejectionReason: undefined });
    });
    const sub = getSubscription(s, LEARNERS.learnerRejected, FIXED_NOW);
    expect(sub.pending?.id).toBe("r-karan-2");
    expect(sub.lastRejected).toBeUndefined();
    // history keeps both, newest first
    expect(sub.requests.map((r) => r.id)).toEqual(["r-karan-2", "r-karan"]);
  });

  it("a subscription ending exactly now is expired, not active", () => {
    const s = createTestState({}, (st) => {
      st.periods = [period("p", "l-x", FIXED_NOW - 30 * DAY, 30)];
    });
    expect(getSubscription(s, "l-x", FIXED_NOW).status).toBe("expired");
  });

  it("SUB-011 — back-to-back renewals extend expiry and widen the running window", () => {
    const start = FIXED_NOW - 10 * DAY;
    const s = createTestState({}, (st) => {
      st.periods = [period("p1", "l-x", start, 30), period("p2", "l-x", start + 30 * DAY, 90)];
    });
    const sub = getSubscription(s, "l-x", FIXED_NOW);
    expect(sub.status).toBe("active");
    expect(sub.expiresAt).toBe(start + 120 * DAY);
    expect(sub.daysLeft).toBe(110);
    expect(sub.windowDays).toBe(120);
  });
});

describe("subscriptionLabel", () => {
  const label = (id: string | null) => subscriptionLabel(subOf(id)).label;

  it("gives each access state a distinct learner-facing label", () => {
    expect(label(null)).toBe("Not subscribed");
    expect(label(LEARNERS.learnerNoSubscription)).toBe("Not subscribed");
    expect(label(LEARNERS.learnerPending)).toBe("Pending approval");
    expect(label(LEARNERS.learnerActive)).toBe("Active");
    expect(label(LEARNERS.learnerExpired)).toBe("Expired");
  });

  it("prefers Active over a pending renewal, and Pending over Expired", () => {
    const base = subOf(LEARNERS.learnerActive);
    const pending = subOf(LEARNERS.learnerPending).pending;
    expect(subscriptionLabel({ ...base, pending }).label).toBe("Active");
    const expired: SubscriptionInfo = { ...subOf(LEARNERS.learnerExpired), pending };
    expect(subscriptionLabel(expired).label).toBe("Pending approval");
  });
});

describe("lesson access", () => {
  const preview = makeLesson("p", { isPreview: true });
  const paid = makeLesson("x");

  it("COURSE-005 — the designated preview is watchable in every state", () => {
    for (const id of [null, LEARNERS.learnerNoSubscription, LEARNERS.learnerPending, LEARNERS.learnerExpired]) {
      expect(canWatchLesson(preview, subOf(id))).toBe(true);
    }
  });

  it("SUB-008 / VID-007 — paid lessons are locked without an active subscription", () => {
    for (const id of [null, LEARNERS.learnerNoSubscription, LEARNERS.learnerPending, LEARNERS.learnerExpired, LEARNERS.learnerRejected]) {
      expect(canWatchLesson(paid, subOf(id))).toBe(false);
    }
  });

  it("SUB-009 — paid lessons unlock with an active subscription", () => {
    expect(canWatchLesson(paid, subOf(LEARNERS.learnerActive))).toBe(true);
  });

  it("every seeded published course has exactly one preview lesson", () => {
    for (const c of publishedCourses(state)) {
      const previews = c.modules.flatMap((m) => m.lessons).filter((l) => l.isPreview);
      expect(previews, c.title).toHaveLength(1);
    }
  });
});

describe("COURSE-009 — courseProgress", () => {
  const course = makeCourse();
  const withProgress = (...entries: ReturnType<typeof makeProgress>[]) =>
    createTestState({}, (s) => {
      s.courses = [course];
      s.progress = entries;
    });

  it("reports zero progress for a visitor", () => {
    expect(courseProgress(withProgress(), null, course)).toMatchObject({ completed: 0, total: 5, percent: 0, started: false });
  });

  it("counts completed lessons and rounds the percentage", () => {
    const s = withProgress(makeProgress("me", "l1", { completed: true }), makeProgress("me", "l2", { completed: true }));
    expect(courseProgress(s, "me", course)).toMatchObject({ completed: 2, total: 5, percent: 40, started: true });
  });

  it("rounds 1 of 3 to 33%", () => {
    const short = makeCourse({ modules: [{ id: "m", title: "M", lessons: [makeLesson("a"), makeLesson("b"), makeLesson("c")] }] });
    const s = createTestState({}, (st) => {
      st.progress = [makeProgress("me", "a", { completed: true })];
    });
    expect(courseProgress(s, "me", short).percent).toBe(33);
  });

  it("ignores progress from other learners and from lessons no longer in the course", () => {
    const s = withProgress(makeProgress("someone-else", "l1", { completed: true }), makeProgress("me", "deleted-lesson", { completed: true }));
    expect(courseProgress(s, "me", course)).toMatchObject({ completed: 0, percent: 0 });
  });

  it("VID-003 — resumes an unfinished lesson where it was left", () => {
    const s = withProgress(makeProgress("me", "l1", { completed: true, updatedAt: 1 }), makeProgress("me", "l3", { positionSec: 120, updatedAt: 2 }));
    expect(courseProgress(s, "me", course).resumeLesson?.id).toBe("l3");
  });

  it("resumes at the next lesson after the most recently completed one", () => {
    const s = withProgress(makeProgress("me", "l3", { completed: true }));
    expect(courseProgress(s, "me", course).resumeLesson?.id).toBe("l4");
  });

  it("stays on the final lesson once the course is finished", () => {
    const s = withProgress(makeProgress("me", "l5", { completed: true }));
    expect(courseProgress(s, "me", course).resumeLesson?.id).toBe("l5");
  });

  it("summarises modules, lessons, duration and the preview", () => {
    expect(courseStats(course)).toMatchObject({ lessonCount: 5, moduleCount: 2, totalSec: 3000 });
    expect(courseStats(course).preview?.id).toBe("l1");
  });
});

describe("test access", () => {
  const regular = makeTest();
  const demo = makeTest({ id: "demo", isDemo: true });

  it("EXAM-001 / EXAM-002 — the demo test is open to a visitor", () => {
    expect(testAccess(demo, null, subOf(null), 0)).toEqual({ allowed: true, reason: "demo" });
  });

  it("AUTH-009 — a regular test asks a visitor to log in", () => {
    expect(testAccess(regular, null, subOf(null), 0)).toEqual({ allowed: false, reason: "login" });
  });

  it.each([
    ["no subscription", LEARNERS.learnerNoSubscription],
    ["pending request", LEARNERS.learnerPending],
    ["expired subscription", LEARNERS.learnerExpired],
  ])("EXAM-003 — a regular test is locked for a learner with %s", (_label, id) => {
    expect(testAccess(regular, id, subOf(id), 0)).toEqual({ allowed: false, reason: "subscribe" });
  });

  it("EXAM-004 — an active learner can start a regular test", () => {
    expect(testAccess(regular, LEARNERS.learnerActive, subOf(LEARNERS.learnerActive), 0)).toEqual({ allowed: true, reason: "subscribed" });
  });

  it("enforces the attempt limit", () => {
    const limited = makeTest({ attemptLimit: 3 });
    const sub = subOf(LEARNERS.learnerActive);
    expect(testAccess(limited, LEARNERS.learnerActive, sub, 2).allowed).toBe(true);
    expect(testAccess(limited, LEARNERS.learnerActive, sub, 3)).toEqual({ allowed: false, reason: "limit" });
  });

  it("blocks an unpublished test for everyone, including the demo", () => {
    expect(testAccess(makeTest({ published: false }), LEARNERS.learnerActive, subOf(LEARNERS.learnerActive), 0).reason).toBe("unpublished");
    expect(testAccess({ ...demo, published: false }, null, subOf(null), 0).reason).toBe("unpublished");
  });
});

describe("catalog selectors", () => {
  it("PUB-003 / PUB-006 — only published courses are public", () => {
    const pub = publishedCourses(state);
    expect(pub.every((c) => c.status === "published")).toBe(true);
    expect(pub.map((c) => c.id)).not.toContain("c-modern"); // draft
    expect(pub.map((c) => c.id)).not.toContain("c-revision25"); // archived
  });

  it("there is exactly one published demo test", () => {
    expect(state.tests.filter((t) => t.isDemo && t.published)).toHaveLength(1);
    expect(demoTest(state)?.id).toBe("t-demo");
  });

  it("unpublished tests are excluded from the catalog", () => {
    expect(publishedTests(state).map((t) => t.id)).not.toContain("t-main-02");
  });
});

describe("EXAM-027 — attempt history", () => {
  it("returns a learner's attempts for a test, newest first", () => {
    const attempts = attemptsFor(state, "t-kinematics", LEARNERS.learnerActive);
    expect(attempts).toHaveLength(2);
    expect(attempts[0].submittedAt).toBeGreaterThan(attempts[1].submittedAt);
  });

  it("never returns attempts for a visitor or another learner", () => {
    expect(attemptsFor(state, "t-kinematics", null)).toEqual([]);
    expect(attemptsFor(state, "t-kinematics", LEARNERS.learnerNoSubscription)).toEqual([]);
  });

  it("SUB-010 — an expired learner keeps their exam history", () => {
    expect(state.attempts.filter((a) => a.learnerId === LEARNERS.learnerExpired).length).toBeGreaterThan(0);
  });

  it("bestAttempt picks the highest score", () => {
    const attempts = attemptsFor(state, "t-kinematics", LEARNERS.learnerActive);
    const best = bestAttempt(attempts)!;
    expect(best.result.score).toBe(Math.max(...attempts.map((a) => a.result.score)));
    expect(bestAttempt([])).toBeUndefined();
  });
});

describe("ADMIN-013 / ADMIN-014 — admin permissions", () => {
  const admin = (id: string) => state.admins.find((a) => a.id === id);

  it("the owner holds every permission", () => {
    for (const p of ["courses", "tests", "learners", "subscriptions", "pricing"] as const) {
      expect(hasPermission(admin(ADMINS.owner), p)).toBe(true);
    }
  });

  it("staffCourseManager can manage content but not learners or pricing", () => {
    const priya = admin(ADMINS.staffCourseManager);
    expect(hasPermission(priya, "courses")).toBe(true);
    expect(hasPermission(priya, "tests")).toBe(true);
    expect(hasPermission(priya, "learners")).toBe(false);
    expect(hasPermission(priya, "pricing")).toBe(false);
  });

  it("staffLimited cannot manage courses or tests", () => {
    const arjun = admin(ADMINS.staffLimited);
    expect(hasPermission(arjun, "courses")).toBe(false);
    expect(hasPermission(arjun, "tests")).toBe(false);
    expect(hasPermission(arjun, "learners")).toBe(true);
  });

  it("no admin means no permission", () => {
    expect(hasPermission(undefined, "courses")).toBe(false);
  });
});
