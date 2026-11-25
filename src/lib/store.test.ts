import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSubscription } from "./access";
import {
  activateManually,
  approveRequest,
  claimAttempt,
  getState,
  liveKey,
  loginLearner,
  logoutLearner,
  rejectRequest,
  saveLessonProgress,
  saveTest,
  setCourseStatus,
  setDemoTest,
  setLessonCompleted,
  signupLearner,
  startLiveExam,
  submitActivationRequest,
  submitLiveExam,
  updateAdminPermissions,
  updateLiveExam,
} from "./store";
import { makeTest } from "@/test/fixtures/exams";
import { createTestState } from "@/test/fixtures/state";
import { DAY, FIXED_NOW, MINUTE } from "@/test/fixtures/time";
import { ADMINS, LEARNERS } from "@/test/fixtures/users";
import { seedStore } from "@/test/render";

const sub = (learnerId: string) => getSubscription(getState(), learnerId, Date.now());

beforeEach(() => {
  vi.setSystemTime(FIXED_NOW);
  seedStore(createTestState());
});

describe("session", () => {
  it("AUTH-004 / AUTH-008 — logging in and out switches the mock session", () => {
    loginLearner(LEARNERS.learnerActive);
    expect(getState().session.learnerId).toBe(LEARNERS.learnerActive);
    logoutLearner();
    expect(getState().session.learnerId).toBeNull();
  });

  it("AUTH-006 — signup adds a learner and signs them in", () => {
    const id = signupLearner({ name: "New Learner", email: "new@example.com", phone: "9876543210", city: "", targetExam: "jee-main", targetYear: 2027 });
    expect(getState().learners.find((l) => l.id === id)).toMatchObject({ email: "new@example.com", joinedAt: FIXED_NOW });
    expect(getState().session.learnerId).toBe(id);
  });

  it("persists the session to this browser only (localStorage)", () => {
    loginLearner(LEARNERS.learnerActive);
    const saved = JSON.parse(window.localStorage.getItem("studyverse-prototype")!);
    expect(saved.session.learnerId).toBe(LEARNERS.learnerActive);
  });
});

describe("BOOK-007 — the guest cart survives login", () => {
  it("moves guest cart lines into the learner's cart", () => {
    seedStore(createTestState({}, (s) => (s.carts = { guest: [{ bookId: "b-1", qty: 2, addedAt: FIXED_NOW }] })));
    loginLearner(LEARNERS.learnerNoSubscription);
    expect(getState().carts[LEARNERS.learnerNoSubscription]).toEqual([{ bookId: "b-1", qty: 2, addedAt: FIXED_NOW }]);
    expect(getState().carts.guest).toBeUndefined();
  });

  it("keeps the larger quantity when the learner already had the same book", () => {
    seedStore(
      createTestState({}, (s) => {
        s.carts = {
          guest: [{ bookId: "b-1", qty: 3, addedAt: FIXED_NOW }],
          [LEARNERS.learnerNoSubscription]: [
            { bookId: "b-1", qty: 1, addedAt: FIXED_NOW - DAY },
            { bookId: "b-2", qty: 1, addedAt: FIXED_NOW - DAY },
          ],
        };
      }),
    );
    loginLearner(LEARNERS.learnerNoSubscription);
    const cart = getState().carts[LEARNERS.learnerNoSubscription];
    expect(cart.map((c) => [c.bookId, c.qty])).toEqual([
      ["b-1", 3],
      ["b-2", 1],
    ]);
  });

  it("carries the guest cart into a newly created account", () => {
    seedStore(createTestState({}, (s) => (s.carts = { guest: [{ bookId: "b-9", qty: 1, addedAt: FIXED_NOW }] })));
    const id = signupLearner({ name: "N", email: "n@example.com", phone: "9876543210", city: "", targetExam: "jee-main", targetYear: 2027 });
    expect(getState().carts[id]).toHaveLength(1);
  });
});

describe("subscription requests", () => {
  it("SUB-003 — submitting creates a pending request and grants no access", () => {
    const id = submitActivationRequest({ learnerId: LEARNERS.learnerNoSubscription, planDays: 30, amount: 499, method: "upi", reference: "123456789012" });
    expect(getState().requests.find((r) => r.id === id)).toMatchObject({ status: "pending", submittedAt: FIXED_NOW });
    expect(sub(LEARNERS.learnerNoSubscription)).toMatchObject({ status: "none", pending: { id } });
  });

  it("SUB-005 — approval activates the learner from today for the approved duration", () => {
    approveRequest("r-diya", 90, ADMINS.owner);
    const req = getState().requests.find((r) => r.id === "r-diya")!;
    expect(req).toMatchObject({ status: "approved", approvedDays: 90, reviewedBy: ADMINS.owner, reviewedAt: FIXED_NOW });
    expect(sub(LEARNERS.learnerPending)).toMatchObject({ status: "active", expiresAt: FIXED_NOW + 90 * DAY, daysLeft: 90 });
    expect(getState().audit[0].text).toBe("Approved 90-day activation for Diya Sharma");
  });

  it("an admin can approve a different duration than requested", () => {
    approveRequest("r-diya", 30, ADMINS.owner);
    expect(sub(LEARNERS.learnerPending).expiresAt).toBe(FIXED_NOW + 30 * DAY);
  });

  it("SUB-006 — rejection records the reason and keeps access locked", () => {
    rejectRequest("r-diya", "Reference not found in statement", ADMINS.owner);
    expect(getState().requests.find((r) => r.id === "r-diya")).toMatchObject({ status: "rejected", rejectionReason: "Reference not found in statement" });
    expect(sub(LEARNERS.learnerPending)).toMatchObject({ status: "none", lastRejected: { id: "r-diya" } });
  });

  it("a request can only be decided once", () => {
    approveRequest("r-diya", 90, ADMINS.owner);
    rejectRequest("r-diya", "Too late", ADMINS.owner);
    approveRequest("r-diya", 365, ADMINS.owner);
    expect(getState().requests.find((r) => r.id === "r-diya")).toMatchObject({ status: "approved", approvedDays: 90 });
    expect(getState().periods.filter((p) => p.learnerId === LEARNERS.learnerPending)).toHaveLength(1);
  });

  it("SUB-007 — a rejected learner can submit again; the rejection stays in history", () => {
    const id = submitActivationRequest({ learnerId: LEARNERS.learnerRejected, planDays: 90, amount: 1299, method: "upi", reference: "402188761123" });
    const info = sub(LEARNERS.learnerRejected);
    expect(info.pending?.id).toBe(id);
    expect(info.requests.map((r) => r.status)).toEqual(["pending", "rejected"]);
  });

  it("SUB-011 — renewing an active plan stacks the new days on top of the current expiry", () => {
    const before = sub(LEARNERS.learnerActive).expiresAt!;
    activateManually(LEARNERS.learnerActive, 30, ADMINS.owner);
    const after = sub(LEARNERS.learnerActive);
    expect(after.expiresAt).toBe(before + 30 * DAY);
    expect(after.periods).toHaveLength(2);
  });

  it("renewing an expired plan starts from today, not from the old expiry", () => {
    activateManually(LEARNERS.learnerExpired, 30, ADMINS.owner);
    expect(sub(LEARNERS.learnerExpired)).toMatchObject({ status: "active", expiresAt: FIXED_NOW + 30 * DAY });
  });
});

describe("lesson progress", () => {
  const progressFor = (lessonId: string) => getState().progress.find((p) => p.learnerId === LEARNERS.learnerActive && p.lessonId === lessonId);

  it("VID-004 — saves a rounded playback position", () => {
    saveLessonProgress(LEARNERS.learnerActive, "c-calculus", "c-calculus-m1-l2", 123.6);
    expect(progressFor("c-calculus-m1-l2")).toMatchObject({ positionSec: 124, completed: false, updatedAt: FIXED_NOW });
  });

  it("VID-006 — saving a later position never un-completes a lesson", () => {
    saveLessonProgress(LEARNERS.learnerActive, "c-calculus", "c-calculus-m1-l2", 600, true);
    saveLessonProgress(LEARNERS.learnerActive, "c-calculus", "c-calculus-m1-l2", 10);
    expect(progressFor("c-calculus-m1-l2")).toMatchObject({ positionSec: 10, completed: true });
  });

  it("VID-005 — manual completion can be set and cleared, keeping the position", () => {
    saveLessonProgress(LEARNERS.learnerActive, "c-calculus", "c-calculus-m1-l2", 300);
    setLessonCompleted(LEARNERS.learnerActive, "c-calculus", "c-calculus-m1-l2", true);
    expect(progressFor("c-calculus-m1-l2")).toMatchObject({ positionSec: 300, completed: true });
    setLessonCompleted(LEARNERS.learnerActive, "c-calculus", "c-calculus-m1-l2", false);
    expect(progressFor("c-calculus-m1-l2")?.completed).toBe(false);
  });

  it("keeps one progress entry per learner and lesson", () => {
    saveLessonProgress(LEARNERS.learnerActive, "c-calculus", "c-calculus-m1-l2", 50);
    saveLessonProgress(LEARNERS.learnerActive, "c-calculus", "c-calculus-m1-l2", 70);
    expect(getState().progress.filter((p) => p.learnerId === LEARNERS.learnerActive && p.lessonId === "c-calculus-m1-l2")).toHaveLength(1);
  });
});

describe("live exams", () => {
  const test = makeTest();
  const learner = LEARNERS.learnerActive;
  const key = liveKey(learner, test.id);

  beforeEach(() => {
    seedStore(createTestState({}, (s) => s.tests.push(test)));
  });

  it("starting an exam snapshots the test and visits the first question", () => {
    startLiveExam(test, learner);
    expect(getState().liveExams[key]).toMatchObject({ testId: test.id, startedAt: FIXED_NOW, visited: ["q1"], currentSectionId: "s-phy", currentQuestionId: "q1" });
  });

  it("EXAM-028 — starting again resumes the same attempt instead of resetting it", () => {
    startLiveExam(test, learner);
    updateLiveExam(key, (l) => ({ ...l, responses: { q1: { optionIds: ["q1-b"] } } }));
    startLiveExam(test, learner);
    expect(getState().liveExams[key].responses).toEqual({ q1: { optionIds: ["q1-b"] } });
  });

  it("EXAM-024 / EXAM-025 — submitting scores the attempt and ends the live exam", () => {
    startLiveExam(test, learner);
    updateLiveExam(key, (l) => ({ ...l, responses: { q1: { optionIds: ["q1-b"] }, q3: { value: "12.5" } }, visited: ["q1", "q2", "q3"], marked: ["q3"] }));
    vi.setSystemTime(FIXED_NOW + 12 * MINUTE);

    const id = submitLiveExam(key, false)!;
    const attempt = getState().attempts.find((a) => a.id === id)!;

    expect(getState().liveExams[key]).toBeUndefined();
    expect(attempt).toMatchObject({ learnerId: learner, autoSubmitted: false, timeTakenSec: 720 });
    expect(attempt.result).toMatchObject({ score: 8, correct: 2, unattempted: 2 });
    expect(attempt.states).toEqual({ q1: "answered", q2: "not-answered", q3: "answered-review", q4: "not-visited" });
  });

  it("caps time taken at the test duration", () => {
    startLiveExam(test, learner);
    vi.setSystemTime(FIXED_NOW + 2 * 60 * MINUTE);
    const id = submitLiveExam(key, true)!;
    expect(getState().attempts.find((a) => a.id === id)).toMatchObject({ autoSubmitted: true, timeTakenSec: 30 * 60 });
  });

  it("EXAM-029 — a repeated submit creates no second result", () => {
    startLiveExam(test, learner);
    const first = submitLiveExam(key, false);
    const count = getState().attempts.length;
    expect(submitLiveExam(key, false)).toBeNull();
    expect(first).not.toBeNull();
    expect(getState().attempts).toHaveLength(count);
  });

  it("a guest demo attempt can be claimed by the learner who signs in afterwards", () => {
    startLiveExam(test, null);
    const id = submitLiveExam(liveKey(null, test.id), false)!;
    claimAttempt(id, LEARNERS.learnerNoSubscription);
    expect(getState().attempts.find((a) => a.id === id)?.learnerId).toBe(LEARNERS.learnerNoSubscription);
  });

  it("an attempt that already belongs to a learner cannot be claimed by someone else", () => {
    const owned = getState().attempts.find((a) => a.learnerId === LEARNERS.learnerActive)!;
    claimAttempt(owned.id, LEARNERS.learnerNoSubscription);
    expect(getState().attempts.find((a) => a.id === owned.id)?.learnerId).toBe(LEARNERS.learnerActive);
  });
});

describe("admin content management", () => {
  it("COURSE-003 / COURSE-004 / ADMIN-007 — publish and archive change public visibility", () => {
    setCourseStatus("c-modern", "published", ADMINS.owner);
    expect(getState().courses.find((c) => c.id === "c-modern")?.status).toBe("published");
    setCourseStatus("c-modern", "archived", ADMINS.owner);
    expect(getState().courses.find((c) => c.id === "c-modern")?.status).toBe("archived");
    expect(getState().audit[0].text).toMatch(/^Archived course/);
  });

  it("ADMIN-011 — editing a test with attempts bumps its version and leaves past snapshots intact", () => {
    const demo = getState().tests.find((t) => t.id === "t-demo")!;
    const pastSnapshot = getState().attempts.find((a) => a.testId === "t-demo")!.snapshot;
    saveTest({ ...demo, title: "Demo v-next" }, ADMINS.owner);

    const saved = getState().tests.find((t) => t.id === "t-demo")!;
    expect(saved.version).toBe(demo.version + 1);
    expect(getState().attempts.find((a) => a.testId === "t-demo")!.snapshot).toEqual(pastSnapshot);
    expect(pastSnapshot.title).toBe("Free Demo Test — JEE Main Pattern");
  });

  it("editing a test with no attempts keeps the same version", () => {
    const draft = getState().tests.find((t) => t.id === "t-main-02")!;
    saveTest({ ...draft, title: "Renamed draft" }, ADMINS.owner);
    expect(getState().tests.find((t) => t.id === "t-main-02")?.version).toBe(draft.version);
  });

  it("there is always exactly one demo test, and making a test the demo publishes it", () => {
    setDemoTest("t-main-02", ADMINS.owner);
    const demos = getState().tests.filter((t) => t.isDemo);
    expect(demos.map((t) => t.id)).toEqual(["t-main-02"]);
    expect(demos[0].published).toBe(true);
  });

  it("ADMIN-013 — the owner's permissions cannot be changed", () => {
    const before = getState().admins.find((a) => a.id === ADMINS.owner)!.permissions;
    updateAdminPermissions(ADMINS.owner, [], ADMINS.owner);
    expect(getState().admins.find((a) => a.id === ADMINS.owner)!.permissions).toEqual(before);
  });

  it("ADMIN-012 — the owner can change a staff member's permissions", () => {
    updateAdminPermissions(ADMINS.staffLimited, ["courses"], ADMINS.owner);
    expect(getState().admins.find((a) => a.id === ADMINS.staffLimited)!.permissions).toEqual(["courses"]);
  });
});
