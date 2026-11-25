"use client";

import { useSyncExternalStore } from "react";
import { scoreSnapshot, snapshotOf, stateOf } from "./exam";
import { createSeed, SERVER_ANCHOR, STATE_VERSION, type AppState, type Prefs } from "./mock/seed";
import type {
  Admin,
  Attempt,
  Course,
  CourseStatus,
  Learner,
  LiveExam,
  PaymentSettings,
  Permission,
  Plan,
  PlanDays,
  PlatformSettings,
  SubscriptionRequest,
  Test,
} from "./types";
import { DAY, uid } from "./utils";

/* ------------------------------------------------------------------
   Prototype store
   - All data is mock data that lives in memory + this browser's
     localStorage. Nothing is sent to a server.
   - Server render uses a deterministic snapshot (fixed time anchor),
     the browser swaps in persisted data after hydration.
------------------------------------------------------------------- */

const STORAGE_KEY = "studyverse-prototype";
const serverState: AppState = createSeed(SERVER_ANCHOR);

let state: AppState | undefined;
const listeners = new Set<() => void>();
let storageBound = false;

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === STATE_VERSION) return { ...parsed, ready: true };
    }
  } catch {
    // ignore malformed or blocked storage
  }
  const fresh = { ...createSeed(Date.now()), ready: true };
  persist(fresh);
  return fresh;
}

function persist(s: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, ready: false }));
  } catch {
    // storage may be full or unavailable (private mode) — prototype keeps working in memory
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  if (typeof window === "undefined") return serverState;
  if (!state) state = load();
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!storageBound && typeof window !== "undefined") {
    storageBound = true;
    // Cross-tab sync: an admin approving a request in one tab updates the learner tab.
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY) return;
      state = e.newValue ? { ...(JSON.parse(e.newValue) as AppState), ready: true } : load();
      emit();
    });
  }
  return () => listeners.delete(listener);
}

export function setState(updater: (s: AppState) => AppState) {
  state = updater(getState());
  persist(state);
  emit();
}

const getServerSnapshot = () => serverState;

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getServerSnapshot);
}

/* ------------------------------ Clock ------------------------------ */

let clock = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | undefined;

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      clock = Date.now();
      clockListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = undefined;
      // Forget the cached time so the next subscriber starts from the real clock, not a stale tick.
      clock = 0;
    }
  };
}

function readClock() {
  if (!clock) clock = Date.now();
  return clock;
}

/**
 * Current time, safe for rendering. Re-renders at most once per `granularityMs`.
 * The server snapshot uses the fixed anchor so prerendered HTML is deterministic.
 */
export function useNow(granularityMs = 60_000): number {
  return useSyncExternalStore(
    subscribeClock,
    () => Math.floor(readClock() / granularityMs) * granularityMs,
    () => SERVER_ANCHOR,
  );
}

/* --------------------------- Session --------------------------- */

/** Moves the visitor's cart into the learner's cart so checkout can continue after login */
function mergeGuestCart(s: AppState, learnerId: string): AppState {
  const guest = s.carts?.guest ?? [];
  if (!guest.length) return s;
  const mine = [...(s.carts[learnerId] ?? [])];
  for (const g of guest) {
    const existing = mine.find((m) => m.bookId === g.bookId);
    if (existing) existing.qty = Math.max(existing.qty, g.qty);
    else mine.push(g);
  }
  const carts = { ...s.carts, [learnerId]: mine.map((m) => ({ ...m })) };
  delete carts.guest;
  return { ...s, carts };
}

export function loginLearner(learnerId: string) {
  setState((s) => mergeGuestCart({ ...s, session: { ...s.session, learnerId } }, learnerId));
}

export function logoutLearner() {
  setState((s) => ({ ...s, session: { ...s.session, learnerId: null } }));
}

export function loginAdmin(adminId: string) {
  setState((s) => ({
    ...s,
    session: { ...s.session, adminId },
    admins: s.admins.map((a) => (a.id === adminId ? { ...a, lastActiveAt: Date.now(), status: "active" } : a)),
  }));
}

export function logoutAdmin() {
  setState((s) => ({ ...s, session: { ...s.session, adminId: null } }));
}

export function signupLearner(data: Omit<Learner, "id" | "joinedAt">): string {
  const id = uid("l");
  setState((s) =>
    mergeGuestCart(
      {
        ...s,
        learners: [{ ...data, id, joinedAt: Date.now() }, ...s.learners],
        session: { ...s.session, learnerId: id },
      },
      id,
    ),
  );
  return id;
}

export function updateLearner(id: string, patch: Partial<Learner>) {
  setState((s) => ({ ...s, learners: s.learners.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
}

export function setPrefs(patch: Partial<Prefs>) {
  setState((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));
}

export function resetPrototype() {
  const fresh = { ...createSeed(Date.now()), ready: true };
  state = fresh;
  persist(fresh);
  emit();
}

export function audit(s: AppState, actorId: string | null, text: string, ref?: string): AppState {
  const actor = s.admins.find((a) => a.id === actorId)?.name ?? "System";
  return { ...s, audit: [{ id: uid("au"), at: Date.now(), actor, text, ref }, ...s.audit].slice(0, 200) };
}

/* --------------------------- Learning --------------------------- */

export function saveLessonProgress(
  learnerId: string,
  courseId: string,
  lessonId: string,
  positionSec: number,
  markComplete = false,
) {
  setState((s) => {
    const existing = s.progress.find((p) => p.learnerId === learnerId && p.lessonId === lessonId);
    const entry = {
      learnerId,
      courseId,
      lessonId,
      positionSec: Math.round(positionSec),
      completed: (existing?.completed ?? false) || markComplete,
      updatedAt: Date.now(),
    };
    const progress = existing
      ? s.progress.map((p) => (p === existing ? entry : p))
      : [...s.progress, entry];
    return { ...s, progress };
  });
}

export function setLessonCompleted(learnerId: string, courseId: string, lessonId: string, completed: boolean) {
  setState((s) => {
    const existing = s.progress.find((p) => p.learnerId === learnerId && p.lessonId === lessonId);
    const entry = {
      learnerId,
      courseId,
      lessonId,
      positionSec: existing?.positionSec ?? 0,
      completed,
      updatedAt: Date.now(),
    };
    return {
      ...s,
      progress: existing ? s.progress.map((p) => (p === existing ? entry : p)) : [...s.progress, entry],
    };
  });
}

/* ------------------------ Subscriptions ------------------------ */

export function submitActivationRequest(
  data: Pick<SubscriptionRequest, "learnerId" | "planDays" | "amount" | "method" | "reference" | "screenshotName" | "note">,
): string {
  const id = uid("r");
  setState((s) => ({
    ...s,
    requests: [{ ...data, id, submittedAt: Date.now(), status: "pending" }, ...s.requests],
  }));
  return id;
}

function addPeriod(s: AppState, learnerId: string, days: number, adminId: string, requestId?: string): AppState {
  const now = Date.now();
  const currentExpiry = s.periods
    .filter((p) => p.learnerId === learnerId && p.expiresAt > now)
    .reduce((max, p) => Math.max(max, p.expiresAt), 0);
  const startsAt = currentExpiry > now ? currentExpiry : now;
  return {
    ...s,
    periods: [
      ...s.periods,
      {
        id: uid("p"),
        learnerId,
        days,
        startsAt,
        expiresAt: startsAt + days * DAY,
        activatedAt: now,
        activatedBy: adminId,
        requestId,
      },
    ],
  };
}

export function approveRequest(requestId: string, days: PlanDays, adminId: string) {
  setState((s) => {
    const req = s.requests.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") return s;
    const learner = s.learners.find((l) => l.id === req.learnerId);
    let next: AppState = {
      ...s,
      requests: s.requests.map((r) =>
        r.id === requestId
          ? { ...r, status: "approved", approvedDays: days, reviewedAt: Date.now(), reviewedBy: adminId }
          : r,
      ),
    };
    next = addPeriod(next, req.learnerId, days, adminId, requestId);
    return audit(next, adminId, `Approved ${days}-day activation for ${learner?.name ?? "learner"}`);
  });
}

export function rejectRequest(requestId: string, reason: string, adminId: string) {
  setState((s) => {
    const req = s.requests.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") return s;
    const learner = s.learners.find((l) => l.id === req.learnerId);
    const next: AppState = {
      ...s,
      requests: s.requests.map((r) =>
        r.id === requestId
          ? { ...r, status: "rejected", rejectionReason: reason, reviewedAt: Date.now(), reviewedBy: adminId }
          : r,
      ),
    };
    return audit(next, adminId, `Rejected activation request from ${learner?.name ?? "learner"}`);
  });
}

export function activateManually(learnerId: string, days: PlanDays, adminId: string) {
  setState((s) => {
    const learner = s.learners.find((l) => l.id === learnerId);
    return audit(addPeriod(s, learnerId, days, adminId), adminId, `Manually activated ${days} days for ${learner?.name ?? "learner"}`);
  });
}

export function updatePlans(plans: Plan[], adminId: string) {
  setState((s) => audit({ ...s, plans }, adminId, "Updated subscription pricing"));
}

export function updatePaymentSettings(payment: PaymentSettings, adminId: string) {
  setState((s) => audit({ ...s, payment }, adminId, "Updated payment instructions"));
}

export function updatePlatformSettings(platform: PlatformSettings, adminId: string) {
  setState((s) => audit({ ...s, platform }, adminId, "Updated platform settings"));
}

/* ------------------------------ Exams ------------------------------ */

export const liveKey = (learnerId: string | null, testId: string) => `${learnerId ?? "guest"}:${testId}`;

export function startLiveExam(test: Test, learnerId: string | null): string {
  const key = liveKey(learnerId, test.id);
  setState((s) => {
    if (s.liveExams[key]) return s;
    const snapshot = snapshotOf(test);
    const firstSection = snapshot.sections[0];
    const firstQ = firstSection.questions[0];
    const now = Date.now();
    const live: LiveExam = {
      key,
      testId: test.id,
      learnerId,
      startedAt: now,
      snapshot,
      responses: {},
      visited: [firstQ.id],
      marked: [],
      currentSectionId: firstSection.id,
      currentQuestionId: firstQ.id,
      sectionElapsed: {},
      sectionActiveSince: now,
      lockedSectionIds: [],
    };
    return { ...s, liveExams: { ...s.liveExams, [key]: live } };
  });
  return key;
}

export function updateLiveExam(key: string, updater: (live: LiveExam) => LiveExam) {
  setState((s) => {
    const live = s.liveExams[key];
    if (!live) return s;
    return { ...s, liveExams: { ...s.liveExams, [key]: updater(live) } };
  });
}

export function discardLiveExam(key: string) {
  setState((s) => {
    const rest = { ...s.liveExams };
    delete rest[key];
    return { ...s, liveExams: rest };
  });
}

export function submitLiveExam(key: string, autoSubmitted: boolean): string | null {
  const live = getState().liveExams[key];
  if (!live) return null;
  const id = uid("at");
  setState((s) => {
    const current = s.liveExams[key];
    if (!current) return s;
    const now = Date.now();
    const states: Attempt["states"] = {};
    current.snapshot.sections.forEach((sec) => sec.questions.forEach((q) => (states[q.id] = stateOf(current, q))));
    const totalSec = current.snapshot.durationMin * 60;
    const attempt: Attempt = {
      id,
      testId: current.testId,
      learnerId: current.learnerId,
      startedAt: current.startedAt,
      submittedAt: now,
      autoSubmitted,
      timeTakenSec: Math.min(totalSec, Math.round((now - current.startedAt) / 1000)),
      snapshot: current.snapshot,
      responses: current.responses,
      states,
      result: scoreSnapshot(current.snapshot, current.responses),
    };
    const rest = { ...s.liveExams };
    delete rest[key];
    return { ...s, liveExams: rest, attempts: [attempt, ...s.attempts] };
  });
  return id;
}

export function claimAttempt(attemptId: string, learnerId: string) {
  setState((s) => ({
    ...s,
    attempts: s.attempts.map((a) => (a.id === attemptId && a.learnerId === null ? { ...a, learnerId } : a)),
  }));
}

/* -------------------------- Admin: courses -------------------------- */

export function createCourse(data: Omit<Course, "id" | "createdAt" | "updatedAt">, adminId: string): string {
  const id = uid("c");
  setState((s) => {
    const now = Date.now();
    const next = { ...s, courses: [{ ...data, id, createdAt: now, updatedAt: now }, ...s.courses] };
    return audit(next, adminId, `Created course “${data.title}”`);
  });
  return id;
}

export function saveCourse(course: Course, adminId: string) {
  setState((s) =>
    audit(
      { ...s, courses: s.courses.map((c) => (c.id === course.id ? { ...course, updatedAt: Date.now() } : c)) },
      adminId,
      `Updated course “${course.title}”`,
    ),
  );
}

export function setCourseStatus(courseId: string, status: CourseStatus, adminId: string) {
  setState((s) => {
    const course = s.courses.find((c) => c.id === courseId);
    const verb = status === "published" ? "Published" : status === "archived" ? "Archived" : "Moved to draft";
    return audit(
      { ...s, courses: s.courses.map((c) => (c.id === courseId ? { ...c, status, updatedAt: Date.now() } : c)) },
      adminId,
      `${verb} course “${course?.title ?? ""}”`,
    );
  });
}

export function deleteCourse(courseId: string, adminId: string) {
  setState((s) => {
    const course = s.courses.find((c) => c.id === courseId);
    return audit({ ...s, courses: s.courses.filter((c) => c.id !== courseId) }, adminId, `Deleted course “${course?.title ?? ""}”`);
  });
}

/* --------------------------- Admin: tests --------------------------- */

export function createTest(data: Omit<Test, "id" | "createdAt" | "updatedAt" | "version">, adminId: string): string {
  const id = uid("t");
  setState((s) => {
    const now = Date.now();
    const next = { ...s, tests: [{ ...data, id, version: 1, createdAt: now, updatedAt: now }, ...s.tests] };
    return audit(next, adminId, `Created test “${data.title}”`);
  });
  return id;
}

export function saveTest(test: Test, adminId: string) {
  setState((s) => {
    const prev = s.tests.find((t) => t.id === test.id);
    const hasAttempts = s.attempts.some((a) => a.testId === test.id);
    // Editing a test that already has attempts creates a new version; history keeps its snapshot.
    const version = prev && hasAttempts ? prev.version + 1 : test.version;
    return audit(
      { ...s, tests: s.tests.map((t) => (t.id === test.id ? { ...test, version, updatedAt: Date.now() } : t)) },
      adminId,
      `Updated test “${test.title}”${version !== test.version ? ` (now v${version})` : ""}`,
    );
  });
}

export function setTestPublished(testId: string, published: boolean, adminId: string) {
  setState((s) => {
    const test = s.tests.find((t) => t.id === testId);
    return audit(
      { ...s, tests: s.tests.map((t) => (t.id === testId ? { ...t, published, updatedAt: Date.now() } : t)) },
      adminId,
      `${published ? "Published" : "Unpublished"} test “${test?.title ?? ""}”`,
    );
  });
}

export function setDemoTest(testId: string, adminId: string) {
  setState((s) => {
    const test = s.tests.find((t) => t.id === testId);
    return audit(
      { ...s, tests: s.tests.map((t) => ({ ...t, isDemo: t.id === testId, published: t.id === testId ? true : t.published })) },
      adminId,
      `Set “${test?.title ?? ""}” as the free demo test`,
    );
  });
}

export function setSolutionsReleased(testId: string, released: boolean, adminId: string) {
  setState((s) => {
    const test = s.tests.find((t) => t.id === testId);
    return audit(
      { ...s, tests: s.tests.map((t) => (t.id === testId ? { ...t, solutionsReleased: released } : t)) },
      adminId,
      `${released ? "Released" : "Withheld"} solutions for “${test?.title ?? ""}”`,
    );
  });
}

export function deleteTest(testId: string, adminId: string) {
  setState((s) => {
    const test = s.tests.find((t) => t.id === testId);
    return audit({ ...s, tests: s.tests.filter((t) => t.id !== testId) }, adminId, `Deleted test “${test?.title ?? ""}”`);
  });
}

/* --------------------------- Admin: staff --------------------------- */

export function inviteAdmin(data: { name: string; email: string; permissions: Permission[] }, ownerId: string): string {
  const id = uid("a");
  setState((s) => {
    const admin: Admin = { id, name: data.name, email: data.email, role: "staff", permissions: data.permissions, status: "invited", invitedAt: Date.now(), bookPermissions: [] };
    return audit({ ...s, admins: [...s.admins, admin] }, ownerId, `Invited ${data.name} as staff admin`);
  });
  return id;
}

export function updateAdminPermissions(adminId: string, permissions: Permission[], ownerId: string) {
  setState((s) => {
    const target = s.admins.find((a) => a.id === adminId);
    if (!target || target.role === "owner") return s;
    return audit(
      { ...s, admins: s.admins.map((a) => (a.id === adminId ? { ...a, permissions } : a)) },
      ownerId,
      `Updated permissions for ${target.name}`,
    );
  });
}

export function removeAdmin(adminId: string, ownerId: string) {
  setState((s) => {
    const target = s.admins.find((a) => a.id === adminId);
    if (!target || target.role === "owner") return s;
    return audit({ ...s, admins: s.admins.filter((a) => a.id !== adminId) }, ownerId, `Removed admin ${target.name}`);
  });
}

export function updateAdminProfile(adminId: string, patch: Partial<Pick<Admin, "name" | "email">>) {
  setState((s) => ({ ...s, admins: s.admins.map((a) => (a.id === adminId ? { ...a, ...patch } : a)) }));
}
