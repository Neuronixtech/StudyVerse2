import { scoreSnapshot, snapshotOf } from "../exam";
import type {
  Address,
  AppNotification,
  Book,
  BookOrder,
  BookstoreSettings,
  CartItem,
  StockMovement,
  Admin,
  Attempt,
  AuditEntry,
  Course,
  Learner,
  LessonProgress,
  LiveExam,
  PaymentSettings,
  Plan,
  PlatformSettings,
  QuestionResponse,
  QuestionState,
  SubscriptionPeriod,
  SubscriptionRequest,
  Test,
} from "../types";
import { DAY, HOUR, MINUTE } from "../utils";
import { seedBookstore } from "./bookstore";
import { seedCourses } from "./courses";
import { seedTests } from "./tests";

export const STATE_VERSION = 4;

/** Fixed time used for the server prerender, so the static HTML is deterministic. */
export const SERVER_ANCHOR = Date.UTC(2026, 10, 13, 4, 30);

export interface Prefs {
  simulateLatency: boolean;
  simulateError: boolean;
}

export interface AppState {
  version: number;
  anchor: number;
  /** false while rendering the deterministic server snapshot (before browser data loads) */
  ready: boolean;
  courses: Course[];
  tests: Test[];
  learners: Learner[];
  admins: Admin[];
  requests: SubscriptionRequest[];
  periods: SubscriptionPeriod[];
  attempts: Attempt[];
  progress: LessonProgress[];
  liveExams: Record<string, LiveExam>;
  plans: Plan[];
  payment: PaymentSettings;
  platform: PlatformSettings;
  session: { learnerId: string | null; adminId: string | null };
  prefs: Prefs;
  audit: AuditEntry[];
  /* Bookstore */
  books: Book[];
  bookOrders: BookOrder[];
  addresses: Address[];
  stockMovements: StockMovement[];
  /** Keyed by learner id, or "guest" for visitors (preserved through login) */
  carts: Record<string, CartItem[]>;
  notifications: AppNotification[];
  bookstore: BookstoreSettings;
}

/** Demo personas surfaced in the prototype toolbar and login screens */
export const LEARNER_PERSONAS = [
  { id: "l-aarav", label: "No subscription", tone: "slate" },
  { id: "l-diya", label: "Pending request", tone: "amber" },
  { id: "l-rohan", label: "Active subscription", tone: "green" },
  { id: "l-sneha", label: "Expired subscription", tone: "red" },
] as const;

export const ADMIN_PERSONAS = [
  { id: "a-vikram", label: "Owner" },
  { id: "a-priya", label: "Staff admin" },
] as const;

type Pattern = "c" | "w" | "s" | "p";

function buildResponses(test: Test, pattern: Pattern[]) {
  const responses: Record<string, QuestionResponse> = {};
  const states: Record<string, QuestionState> = {};
  let i = 0;
  for (const s of test.sections) {
    for (const q of s.questions) {
      const p = pattern[i % pattern.length];
      i++;
      if (p === "s") {
        states[q.id] = i % 4 === 0 ? "not-visited" : "not-answered";
        continue;
      }
      states[q.id] = i % 7 === 0 ? "answered-review" : "answered";
      if (q.type === "numerical" && q.numerical) {
        responses[q.id] = { value: String(p === "w" ? q.numerical.value + 2 : q.numerical.value) };
      } else if (q.type === "single") {
        const wrong = q.options.find((o) => !q.correctOptionIds.includes(o.id))!;
        responses[q.id] = { optionIds: [p === "w" ? wrong.id : q.correctOptionIds[0]] };
      } else {
        const wrong = q.options.find((o) => !q.correctOptionIds.includes(o.id))!;
        if (p === "w") responses[q.id] = { optionIds: [q.correctOptionIds[0], wrong.id] };
        else if (p === "p") responses[q.id] = { optionIds: [q.correctOptionIds[0]] };
        else responses[q.id] = { optionIds: [...q.correctOptionIds] };
      }
    }
  }
  return { responses, states };
}

export function createSeed(anchor: number): AppState {
  const ago = (days: number) => anchor - days * DAY;
  const courses = seedCourses(anchor);
  const tests = seedTests(anchor);
  const testById = (id: string) => tests.find((t) => t.id === id)!;

  const learners: Learner[] = [
    { id: "l-aarav", name: "Aarav Mehta", email: "aarav@example.com", phone: "+91 98220 11223", city: "Pune", targetExam: "jee-main", targetYear: 2027, joinedAt: ago(8) },
    { id: "l-diya", name: "Diya Sharma", email: "diya@example.com", phone: "+91 98290 44556", city: "Jaipur", targetExam: "jee-main", targetYear: 2027, joinedAt: ago(15) },
    { id: "l-rohan", name: "Rohan Iyer", email: "rohan@example.com", phone: "+91 94440 77889", city: "Chennai", targetExam: "jee-advanced", targetYear: 2027, joinedAt: ago(60) },
    { id: "l-sneha", name: "Sneha Patil", email: "sneha@example.com", phone: "+91 97650 33445", city: "Nashik", targetExam: "mht-cet", targetYear: 2027, joinedAt: ago(75) },
    { id: "l-karan", name: "Karan Gupta", email: "karan@example.com", phone: "+91 99350 66778", city: "Lucknow", targetExam: "jee-main", targetYear: 2028, joinedAt: ago(6) },
    { id: "l-ishita", name: "Ishita Banerjee", email: "ishita@example.com", phone: "+91 98300 12121", city: "Kolkata", targetExam: "jee-advanced", targetYear: 2027, joinedAt: ago(110) },
    { id: "l-vihaan", name: "Vihaan Reddy", email: "vihaan@example.com", phone: "+91 98490 34343", city: "Hyderabad", targetExam: "jee-main", targetYear: 2027, joinedAt: ago(95) },
    { id: "l-meera", name: "Meera Joshi", email: "meera@example.com", phone: "+91 98260 56565", city: "Indore", targetExam: "jee-main", targetYear: 2028, joinedAt: ago(3) },
    { id: "l-aditya", name: "Aditya Verma", email: "aditya@example.com", phone: "+91 98110 78787", city: "New Delhi", targetExam: "jee-main", targetYear: 2027, joinedAt: ago(1) },
    { id: "l-ananya", name: "Ananya Singh", email: "ananya@example.com", phone: "+91 94310 90909", city: "Patna", targetExam: "jee-main", targetYear: 2027, joinedAt: ago(130) },
    { id: "l-kabir", name: "Kabir Khan", email: "kabir@example.com", phone: "+91 98930 24680", city: "Bhopal", targetExam: "jee-main", targetYear: 2027, joinedAt: ago(12) },
    { id: "l-tanvi", name: "Tanvi Deshmukh", email: "tanvi@example.com", phone: "+91 98230 13579", city: "Nagpur", targetExam: "mht-cet", targetYear: 2027, joinedAt: ago(4) },
  ];

  const admins: Admin[] = [
    { id: "a-vikram", name: "Vikram Rao", email: "vikram@studyverse.example", role: "owner", permissions: ["courses", "tests", "learners", "subscriptions", "pricing"], status: "active", invitedAt: ago(400), lastActiveAt: ago(0.1), bookPermissions: [] },
    { id: "a-priya", name: "Priya Nair", email: "priya@studyverse.example", role: "staff", permissions: ["courses", "tests", "subscriptions"], status: "active", invitedAt: ago(200), lastActiveAt: ago(0.3), bookPermissions: ["books.edit", "books.photos", "inventory.adjust", "orders.process", "dispatch.manage", "reports.view"] },
    { id: "a-arjun", name: "Arjun Das", email: "arjun@studyverse.example", role: "staff", permissions: ["learners", "subscriptions"], status: "invited", invitedAt: ago(2), bookPermissions: ["payments.verify", "cancellations.decide", "returns.review", "refunds.record", "reports.view"] },
  ];

  const approved = (
    id: string,
    learnerId: string,
    days: 30 | 90 | 365,
    amount: number,
    method: "upi" | "bank",
    reference: string,
    reviewedDaysAgo: number,
    reviewedBy: string,
  ): SubscriptionRequest => ({
    id,
    learnerId,
    planDays: days,
    amount,
    method,
    reference,
    submittedAt: ago(reviewedDaysAgo) - 5 * HOUR,
    status: "approved",
    reviewedAt: ago(reviewedDaysAgo),
    reviewedBy,
    approvedDays: days,
  });

  const requests: SubscriptionRequest[] = [
    { id: "r-diya", learnerId: "l-diya", planDays: 90, amount: 1299, method: "upi", reference: "402188761123", screenshotName: "diya-upi-receipt.png", submittedAt: anchor - 5 * HOUR, status: "pending" },
    { id: "r-meera", learnerId: "l-meera", planDays: 30, amount: 499, method: "bank", reference: "NEFT-N310924588", note: "Paid from my father's account (Rajesh Joshi).", submittedAt: anchor - 26 * HOUR, status: "pending" },
    { id: "r-tanvi", learnerId: "l-tanvi", planDays: 365, amount: 3999, method: "upi", reference: "509912340087", screenshotName: "gpay-screenshot.jpg", submittedAt: ago(2), status: "pending" },
    {
      id: "r-karan",
      learnerId: "l-karan",
      planDays: 90,
      amount: 1299,
      method: "upi",
      reference: "11223344",
      submittedAt: ago(4),
      status: "rejected",
      reviewedAt: ago(3),
      reviewedBy: "a-priya",
      rejectionReason: "We couldn't find this UPI reference in our statement. Please check the 12-digit UPI transaction ID and resubmit.",
    },
    approved("r-rohan", "l-rohan", 90, 1299, "upi", "318876540021", 26, "a-priya"),
    approved("r-ishita", "l-ishita", 365, 3999, "bank", "IMPS-77120345", 100, "a-vikram"),
    approved("r-vihaan", "l-vihaan", 90, 1299, "upi", "220976543310", 85, "a-vikram"),
    approved("r-kabir", "l-kabir", 30, 499, "upi", "611200984455", 10, "a-priya"),
    approved("r-sneha", "l-sneha", 30, 499, "upi", "714455662310", 42, "a-priya"),
    approved("r-ananya", "l-ananya", 30, 499, "bank", "NEFT-N204411876", 70, "a-vikram"),
  ];

  const period = (learnerId: string, requestId: string, startDaysAgo: number, days: number, by: string): SubscriptionPeriod => ({
    id: `p-${learnerId}`,
    learnerId,
    requestId,
    days,
    startsAt: ago(startDaysAgo),
    expiresAt: ago(startDaysAgo) + days * DAY,
    activatedAt: ago(startDaysAgo),
    activatedBy: by,
  });

  const periods: SubscriptionPeriod[] = [
    period("l-rohan", "r-rohan", 26, 90, "a-priya"),
    period("l-ishita", "r-ishita", 100, 365, "a-vikram"),
    period("l-vihaan", "r-vihaan", 85, 90, "a-vikram"),
    period("l-kabir", "r-kabir", 10, 30, "a-priya"),
    period("l-sneha", "r-sneha", 42, 30, "a-priya"),
    period("l-ananya", "r-ananya", 70, 30, "a-vikram"),
  ];

  const progress: LessonProgress[] = [];
  const watch = (learnerId: string, courseId: string, lessonId: string, positionSec: number, completed: boolean, daysAgo: number) =>
    progress.push({ learnerId, courseId, lessonId, positionSec, completed, updatedAt: ago(daysAgo) });

  // Rohan — active learner deep into Mechanics
  watch("l-rohan", "c-mechanics", "c-mechanics-m1-l1", 380, true, 20);
  watch("l-rohan", "c-mechanics", "c-mechanics-m1-l2", 1125, true, 19);
  watch("l-rohan", "c-mechanics", "c-mechanics-m1-l3", 1330, true, 17);
  watch("l-rohan", "c-mechanics", "c-mechanics-m2-l1", 1470, true, 4);
  watch("l-rohan", "c-mechanics", "c-mechanics-m2-l2", 452, false, 0.4);
  watch("l-rohan", "c-organic", "c-organic-m1-l1", 1290, true, 7);
  watch("l-rohan", "c-organic", "c-organic-m1-l2", 300, false, 6);
  watch("l-rohan", "c-calculus", "c-calculus-m1-l1", 950, true, 3);
  // Sneha — expired; history preserved
  watch("l-sneha", "c-mhtcet", "c-mhtcet-m1-l1", 760, true, 30);
  watch("l-sneha", "c-mhtcet", "c-mhtcet-m1-l2", 1500, true, 28);
  watch("l-sneha", "c-mhtcet", "c-mhtcet-m1-l3", 600, false, 13);
  // Aarav — watched a free preview
  watch("l-aarav", "c-mechanics", "c-mechanics-m1-l1", 380, true, 2);
  // Ishita
  watch("l-ishita", "c-electro", "c-electro-m1-l1", 1215, true, 5);
  watch("l-ishita", "c-electro", "c-electro-m1-l2", 800, false, 1);

  const attempts: Attempt[] = [];
  let attemptSeq = 0;
  const attempt = (testId: string, learnerId: string | null, pattern: Pattern[], daysAgo: number, minutes: number, auto = false) => {
    const test = testById(testId);
    const snapshot = snapshotOf(test);
    const { responses, states } = buildResponses(test, pattern);
    const submittedAt = ago(daysAgo);
    attemptSeq++;
    attempts.push({
      id: `at-${String(attemptSeq).padStart(3, "0")}`,
      testId,
      learnerId,
      startedAt: submittedAt - minutes * MINUTE,
      submittedAt,
      autoSubmitted: auto,
      timeTakenSec: minutes * 60,
      snapshot,
      responses,
      states,
      result: scoreSnapshot(snapshot, responses),
    });
  };

  attempt("t-demo", "l-rohan", ["c", "c", "c", "w", "p", "c", "c", "s", "c"], 25, 17);
  attempt("t-kinematics", "l-rohan", ["c", "w", "c", "s", "c", "p"], 18, 14);
  attempt("t-kinematics", "l-rohan", ["c", "c", "c", "c", "c", "p"], 9, 11);
  attempt("t-main-01", "l-rohan", ["c", "c", "w", "s", "c", "c", "p", "c", "w", "c", "s", "c"], 5, 58);
  attempt("t-calculus", "l-rohan", ["c", "c", "w", "p"], 2, 9);
  attempt("t-demo", "l-sneha", ["c", "w", "c", "s", "c", "c", "w", "s", "c"], 40, 20, true);
  attempt("t-cet-maths", "l-sneha", ["c", "c", "c", "w", "c", "s", "c", "c"], 35, 11);
  attempt("t-main-01", "l-ishita", ["c", "c", "c", "w", "c", "c", "p", "c", "c", "c", "s", "c"], 3, 55);
  attempt("t-organic", "l-kabir", ["c", "w", "c", "c", "s", "c"], 1, 13);
  attempt("t-adv-sectional", "l-vihaan", ["c", "p", "c", "w"], 6, 22);
  attempt("t-demo", "l-aarav", ["c", "s", "c", "c", "w", "s", "c", "p", "w"], 2, 19);
  attempt("t-demo", "l-karan", ["w", "c", "s", "c", "c", "w", "s", "c", "c"], 0.6, 18);

  const audit: AuditEntry[] = [
    { id: "au-1", at: ago(3), actor: "Priya Nair", text: "Rejected activation request from Karan Gupta" },
    { id: "au-2", at: ago(8), actor: "Priya Nair", text: "Updated test “Calculus Mastery Test”" },
    { id: "au-3", at: ago(10), actor: "Priya Nair", text: "Approved 30-day activation for Kabir Khan" },
    { id: "au-4", at: ago(2), actor: "Vikram Rao", text: "Invited Arjun Das as staff admin" },
  ];

  return {
    version: STATE_VERSION,
    anchor,
    ready: false,
    courses,
    tests,
    learners,
    admins,
    requests,
    periods,
    attempts,
    progress,
    liveExams: {},
    plans: [
      { days: 30, label: "Monthly", price: 499, enabled: true },
      { days: 90, label: "Quarterly", price: 1299, enabled: true },
      { days: 365, label: "Annual", price: 3999, enabled: true },
    ],
    payment: {
      upiId: "studyverse.demo@upi",
      payeeName: "StudyVerse Learning (Demo)",
      bankName: "Demo Bank of India",
      accountName: "StudyVerse Learning Pvt Ltd (Demo)",
      accountNumber: "0000 1234 5678 4821",
      ifsc: "DEMO0001234",
      terms: [
        "Access starts on the date an admin approves your request, not the payment date.",
        "Renewing while active extends your current expiry — unused days are never lost.",
        "Requests are usually reviewed within 24 hours on working days.",
        "Fees are non-refundable once a subscription has been activated.",
      ],
    },
    platform: { supportEmail: "support@studyverse.example", supportPhone: "+91 20 4000 1234", allowSignups: true },
    session: { learnerId: null, adminId: null },
    prefs: { simulateLatency: false, simulateError: false },
    ...seedBookstore(anchor),
    audit,
  };
}
