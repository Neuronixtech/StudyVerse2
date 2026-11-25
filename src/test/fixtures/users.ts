/**
 * Test-plan user fixtures (FRONTEND_TEST_PLAN.md §8.1) mapped onto the seeded
 * prototype personas. Using the seed keeps unit, component and E2E tests on
 * one shared, deterministic dataset.
 */
export const LEARNERS = {
  /** Learner with no subscription and no requests */
  learnerNoSubscription: "l-aarav",
  /** Learner whose 90-day activation request is pending */
  learnerPending: "l-diya",
  /** Learner with an active subscription (90 days, started 26 days before FIXED_NOW) */
  learnerActive: "l-rohan",
  /** Learner whose 30-day subscription expired 12 days before FIXED_NOW; has progress and attempts */
  learnerExpired: "l-sneha",
  /** Learner whose only request was rejected (no pending request) */
  learnerRejected: "l-karan",
} as const;

export const ADMINS = {
  /** Owner — every permission */
  owner: "a-vikram",
  /** Staff with courses, tests and subscriptions permissions */
  staffCourseManager: "a-priya",
  /** Staff with learners and subscriptions only (no course/test/owner access) */
  staffLimited: "a-arjun",
} as const;

export type LearnerFixture = keyof typeof LEARNERS;
export type AdminFixture = keyof typeof ADMINS;
