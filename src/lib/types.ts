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
  /** Bookstore permissions (ignored for owners, who have all of them) */
  bookPermissions: BookPermission[];
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
  /** Optional entity reference (e.g. a book id) for per-record history */
  ref?: string;
}

/* ---------------------------- Bookstore ---------------------------- */

export type BookPermission =
  | "books.edit"
  | "books.photos"
  | "inventory.adjust"
  | "pricing.change"
  | "payments.verify"
  | "orders.process"
  | "dispatch.manage"
  | "cancellations.decide"
  | "returns.review"
  | "refunds.record"
  | "reports.view";

export type BookStatus = "draft" | "published" | "archived";
export type BookPhotoKind = "cover" | "back" | "contents" | "sample" | "upload";

export interface BookPhoto {
  id: string;
  kind: BookPhotoKind;
  label: string;
  /** Downscaled image for admin uploads (prototype: stored in the browser) */
  dataUrl?: string;
  fileName?: string;
}

/** Each edition/language combination is its own listing with its own price and stock */
export interface Book {
  id: string;
  slug: string;
  title: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  examIds: ExamId[];
  subjectIds: SubjectId[];
  description: string;
  language?: string;
  edition?: string;
  format: string;
  pages?: number;
  mrp: number;
  price: number;
  /** Units on hand (reservations are subtracted separately to get availability) */
  stock: number;
  status: BookStatus;
  theme: ThumbTheme;
  photos: BookPhoto[];
  primaryPhotoId: string;
  sold: number;
  featured: boolean;
  createdAt: number;
  updatedAt: number;
}

export type StockMovementKind = "added" | "damaged" | "correction" | "sale" | "restock" | "replacement";

export interface StockMovement {
  id: string;
  bookId: string;
  at: number;
  delta: number;
  kind: StockMovementKind;
  reason: string;
  actor: string;
  orderId?: string;
}

export interface CartItem {
  bookId: string;
  qty: number;
  addedAt: number;
}

export interface Address {
  id: string;
  learnerId: string;
  fullName: string;
  mobile: string;
  line1: string;
  locality: string;
  city: string;
  state: string;
  pin: string;
  instructions?: string;
  isDefault: boolean;
}

export type AddressSnapshot = Omit<Address, "id" | "learnerId" | "isDefault">;

export type OrderStatus =
  | "pending_payment"
  | "payment_verification"
  | "payment_rejected"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

/** Price snapshot taken when the order is placed */
export interface OrderItem {
  bookId: string;
  title: string;
  author?: string;
  isbn?: string;
  edition?: string;
  language?: string;
  theme: ThumbTheme;
  qty: number;
  unitPrice: number;
  mrp: number;
}

export interface PaymentSubmission {
  id: string;
  submittedAt: number;
  method: PaymentMethod;
  reference: string;
  amount: number;
  screenshotName?: string;
  status: "submitted" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: number;
  rejectionReason?: string;
}

export interface Shipment {
  mode: "courier" | "self";
  courier: string;
  tracking: string;
  dispatchedAt: number;
  notes?: string;
  deliveredAt?: number;
}

export interface Refund {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  status: "pending" | "completed";
  context: "cancellation" | "return" | "adjustment";
  recordedBy: string;
  recordedAt: number;
  completedAt?: number;
}

export interface CancellationRequest {
  requestedAt: number;
  reason: string;
  status: "requested" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: number;
  note?: string;
}

export type ReturnReason = "damaged" | "defective" | "incorrect";

export interface ReturnRequest {
  requestedAt: number;
  reason: ReturnReason;
  details: string;
  photos: string[];
  preference: "replacement" | "refund";
  status: "requested" | "approved" | "rejected" | "resolved";
  decidedBy?: string;
  decidedAt?: number;
  decisionNote?: string;
  replacement?: { courier: string; tracking: string; dispatchedAt: number };
  resolvedAt?: number;
}

export interface OrderEvent {
  id: string;
  at: number;
  actor: string;
  text: string;
  /** Shown on the customer's order timeline (all events appear in the admin audit history) */
  customerVisible: boolean;
}

export interface BookOrder {
  id: string;
  number: string;
  learnerId: string;
  createdAt: number;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  address: AddressSnapshot;
  status: OrderStatus;
  reservationExpiresAt: number;
  payments: PaymentSubmission[];
  shipment?: Shipment;
  hold?: { reason: string; at: number; by: string };
  cancellation?: CancellationRequest;
  returnRequest?: ReturnRequest;
  refunds: Refund[];
  /** Set when an admin edit changes the total after payment: + = extra due, − = refund due */
  paymentDifference?: number;
  events: OrderEvent[];
}

export interface BookstoreSettings {
  shippingFee: number;
  freeShippingThreshold: number;
  lowStockThreshold: number;
  reservationHours: number;
  returnWindowDays: number;
  deliveryEstimate: string;
  upiId: string;
  payeeName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  emailAlerts: boolean;
}

export interface AppNotification {
  id: string;
  learnerId: string;
  at: number;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  /** Email is intended for this event but only simulated in the prototype */
  email: boolean;
}
