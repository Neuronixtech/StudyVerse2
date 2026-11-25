import { createSeed, type AppState } from "@/lib/mock/seed";
import { ADMINS, LEARNERS, type AdminFixture, type LearnerFixture } from "./users";
import { FIXED_NOW } from "./time";

export interface TestStateOptions {
  /** Signed-in learner (omit or null for a visitor) */
  learner?: LearnerFixture | null;
  /** Signed-in admin (omit or null for none) */
  admin?: AdminFixture | null;
  /** Anchor for the seed; defaults to FIXED_NOW */
  now?: number;
}

/**
 * A fresh, fully-loaded prototype state. Every call builds new objects, so
 * tests can mutate the result freely without affecting each other.
 */
export function createTestState(options: TestStateOptions = {}, mutate?: (s: AppState) => void): AppState {
  const { learner = null, admin = null, now = FIXED_NOW } = options;
  const state: AppState = {
    ...createSeed(now),
    ready: true,
    session: {
      learnerId: learner ? LEARNERS[learner] : null,
      adminId: admin ? ADMINS[admin] : null,
    },
  };
  mutate?.(state);
  return state;
}
