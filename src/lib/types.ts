/* ------------------------------------------------------------------
   StudyVerse domain types (UI prototype — mock data only)
------------------------------------------------------------------- */

export type SubjectId = "physics" | "chemistry" | "mathematics";
export type ExamId = "jee-main" | "jee-advanced" | "mht-cet" | "bitsat";

export interface Subject {
  id: SubjectId;
  name: string;
}

export interface ExamCategory {
  id: ExamId;
  name: string;
  short: string;
  description: string;
  comingSoon?: boolean;
}

/* ----------------------------- Courses ----------------------------- */

export type CourseStatus = "draft" | "published" | "archived";
export type ThumbTheme = "teal" | "violet" | "amber" | "sky" | "rose" | "emerald";
export type CourseLevel = "Foundation" | "Intermediate" | "Advanced";

export interface VideoSource {
  kind: "upload" | "url";
  /** File name for simulated uploads, or an external URL */
  ref: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  durationSec: number;
  isPreview: boolean;
  video: VideoSource;
}

export interface CourseModule {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Instructor {
  name: string;
  title: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  theme: ThumbTheme;
  subjectIds: SubjectId[];
  examIds: ExamId[];
  level: CourseLevel;
  instructor: Instructor;
  status: CourseStatus;
  featured: boolean;
  highlights: string[];
  modules: CourseModule[];
  rating: number;
  ratingCount: number;
  enrolled: number;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------ Tests ------------------------------ */

export type QuestionType = "single" | "multi" | "numerical";
export type MultiMarkingRule = "all-or-nothing" | "partial";

export interface Marks {
  correct: number;
  /** Stored as a negative number or 0 */
  incorrect: number;
  unattempted: number;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface NumericalAnswer {
  value: number;
  tolerance: number;
  /** Number of decimal places the learner is expected to enter (display hint) */
  precision: number;
  allowNegative: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  subjectId: SubjectId;
  options: QuestionOption[];
  /** Option ids for single / multi questions */
  correctOptionIds: string[];
  numerical?: NumericalAnswer;
  /** Optional per-question override of the test's default marks */
  marks?: Marks;
  explanation: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

export interface TestSection {
  id: string;
  name: string;
  subjectId?: SubjectId;
  /** Only used when the test uses sectional timing */
  durationMin: number;
  questions: Question[];
}

export type TimingMode = "overall" | "sectional";
export type ResultRelease = "immediate" | "manual";
export type TestKind = "full" | "sectional" | "chapter" | "practice";

export interface Test {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: TestKind;
  examId?: ExamId;
  subjectIds: SubjectId[];
  courseId?: string;
  isDemo: boolean;
  published: boolean;
  timingMode: TimingMode;
  /** Overall duration in minutes when timingMode is "overall" */
  durationMin: number;
  sections: TestSection[];
  defaultMarks: Marks;
  multiMarking: MultiMarkingRule;
  /** null = unlimited */
  attemptLimit: number | null;
  resultRelease: ResultRelease;
  solutionsReleased: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/* --------------------------- People --------------------------- */

export interface Learner {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  targetExam: ExamId;
  targetYear: number;
  joinedAt: number;
}

export type AdminRole = "owner" | "staff";
export type Permission = "courses" | "tests" | "learners" | "subscriptions" | "pricing";

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  permissions: Permission[];
  status: "active" | "invited";
  invitedAt: number;
  lastActiveAt?: number;
}

/* ------------------------ Subscriptions ------------------------ */

export type PlanDays = 30 | 90 | 365;

export interface Plan {
  days: PlanDays;
  label: string;
  price: number;
  enabled: boolean;
}

export type RequestStatus = "pending" | "approved" | "rejected";
export type PaymentMethod = "upi" | "bank";

export interface SubscriptionRequest {
  id: string;
  learnerId: string;
  planDays: PlanDays;
  amount: number;
  method: PaymentMethod;
  reference: string;
  screenshotName?: string;
  note?: string;
  submittedAt: number;
  status: RequestStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  approvedDays?: PlanDays;
  rejectionReason?: string;
}

export interface SubscriptionPeriod {
  id: string;
  learnerId: string;
  days: number;
  startsAt: number;
  expiresAt: number;
  activatedAt: number;
  activatedBy: string;
  requestId?: string;
}

export type SubscriptionStatus = "none" | "active" | "expired";

export interface PaymentSettings {
  upiId: string;
  payeeName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  terms: string[];
}

export interface PlatformSettings {
  supportEmail: string;
  supportPhone: string;
  allowSignups: boolean;
}

/* --------------------------- Learning --------------------------- */

export interface LessonProgress {
  learnerId: string;
  courseId: string;
  lessonId: string;
  positionSec: number;
  completed: boolean;
  updatedAt: number;
}

/* --------------------------- Attempts --------------------------- */

export interface QuestionResponse {
  /** Selected option ids (single / multi) */
  optionIds?: string[];
  /** Raw numerical entry */
  value?: string;
}

export type QuestionState = "not-visited" | "not-answered" | "answered" | "review" | "answered-review";

export interface QuestionEvaluation {
  questionId: string;
  outcome: "correct" | "incorrect" | "partial" | "unattempted";
  marks: number;
}

export interface SectionResult {
  sectionId: string;
  name: string;
  total: number;
  correct: number;
  incorrect: number;
  partial: number;
  unattempted: number;
  score: number;
  maxScore: number;
}

export interface AttemptResult {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  partial: number;
  unattempted: number;
  sections: SectionResult[];
  evaluations: QuestionEvaluation[];
}

/** Frozen copy of the test as it was when the attempt was taken */
export interface TestSnapshot {
  testId: string;
  version: number;
  title: string;
  timingMode: TimingMode;
  durationMin: number;
  defaultMarks: Marks;
  multiMarking: MultiMarkingRule;
  sections: TestSection[];
}

export interface Attempt {
  id: string;
  testId: string;
  /** null for an anonymous visitor demo attempt */
  learnerId: string | null;
  startedAt: number;
  submittedAt: number;
  autoSubmitted: boolean;
  timeTakenSec: number;
  snapshot: TestSnapshot;
  responses: Record<string, QuestionResponse>;
  states: Record<string, QuestionState>;
  result: AttemptResult;
}

/** An exam currently in progress (kept so a refresh does not lose answers) */
export interface LiveExam {
  key: string;
  testId: string;
  learnerId: string | null;
  startedAt: number;
  snapshot: TestSnapshot;
  responses: Record<string, QuestionResponse>;
  visited: string[];
  marked: string[];
  currentSectionId: string;
  currentQuestionId: string;
  /** Sectional timing: seconds consumed per section before the current activation */
  sectionElapsed: Record<string, number>;
  sectionActiveSince: number;
  lockedSectionIds: string[];
}

/* --------------------------- Audit --------------------------- */

export interface AuditEntry {
  id: string;
  at: number;
  actor: string;
  text: string;
}
