# StudyVerse — Product Plan

> **Document purpose:** Describe what StudyVerse is, who it serves, the product experience we intend to create, and the scope of the first UI-design phase. This is a product brief, not a final technical implementation plan.
>
> **Current phase:** Build the user interface with Next.js using mock/fake data only. Do not connect a real database or production services in this phase.

--- 

## 1. Product Overview

**StudyVerse** is an India-focused, subscription-based learning platform for learners preparing for engineering entrance examinations. It brings together structured recorded courses, practice tests, and a competitive-exam experience modeled on familiar Indian computer-based tests such as NTA/JEE.

Admins publish and organize educational content, create examinations, and manage learner subscriptions. Learners browse courses, watch lessons, practise with tests, and track their learning and exam performance.

The platform will initially focus on engineering entrance preparation (for example, JEE Main, JEE Advanced, and MHT-CET), while keeping course and examination classifications flexible enough to support other exam categories in the future.

**Initial audience and language:** India; English-only interface.

## 2. Product Goals

1. Provide a clear, trustworthy learning experience for engineering-entrance aspirants.
2. Make course discovery and recorded-video learning straightforward.
3. Provide a high-quality NTA-style examination experience, including question navigation, status indicators, timers, and review.
4. Offer one simple all-access subscription rather than separate plans for individual courses.
5. Give admins a practical place to manage courses, lessons, tests, questions, learners, and subscription activation.
6. Design the product so its first UI prototype can be reviewed end-to-end before real backend and database integration begins.

## 3. User Roles

### 3.1 Visitor

A visitor is not signed in. Visitors can:
- View the public homepage.
- Browse the course and test catalogs.
- View course and test details.
- Watch lessons explicitly designated as free previews.
- Attempt the one designated free demo test without registration.
- View the demo result after submission.
- Be prompted to sign up or log in when they try to use a feature that requires an account.

### 3.2 Learner

A learner can create a free account and sign in. Learners can:
- Browse all published courses and tests.
- Watch free preview lessons regardless of subscription status.
- Request subscription activation and see request status.
- Watch full course lessons only while their subscription is active.
- Attempt regular published tests only while their subscription is active.
- Attempt the designated free demo test regardless of subscription status.
- Track lesson progress and resume playback.
- View personal exam history and results when signed in.
- View subscription status and expiry date.

An expired or inactive subscription does not disable the learner's account. It removes access to paid lessons and regular tests while preserving permitted browsing, previews, and historical records.

### 3.3 Admin

There are two administrative levels:
- **Owner:** Full administrative control, including managing staff admins and platform-level settings.
- **Staff Admin:** Can be granted operational permissions. Staff must not be able to create or remove admins or change owner-controlled platform settings.

Admins manage courses, lessons, tests, questions, learners, and subscription requests according to their permissions. Admin accounts are created through owner-controlled invitations; there is no public admin registration.

## 4. Subscription Model and Access Rules

StudyVerse launches with one **all-access subscription plan**. An active subscription unlocks all published full course lessons and all regular published tests.

### 4.1 Subscription durations and pricing

- Admin-configurable durations: 30, 90, and 365 days.
- Prices for each duration are configurable by an authorized admin.
- The learner sees the available duration, price, and subscription terms on the Subscribe page.

### 4.2 Manual activation workflow

There is no in-platform payment gateway in the initial product scope. The intended business process is:

1. Learner selects a subscription duration.
2. Learner completes payment outside StudyVerse using an accepted offline method, initially UPI or bank transfer.
3. Learner submits an activation request containing payment method, amount, transaction/reference ID, and an optional payment screenshot.
4. The request appears in the admin panel with **Pending** status.
5. Admin verifies the payment outside the platform and approves or rejects the request.
6. On approval, the admin selects the applicable duration and the subscription becomes active.
7. The learner can see the active status and expiry date in their dashboard.

A submitted request or transaction reference does not itself grant access. Access is granted only after admin approval.

### 4.3 Request lifecycle

- Statuses: Pending, Approved, Rejected.
- Only one pending request is allowed per learner at a time.
- Rejected requests display the admin's rejection reason.
- A learner can submit a new request after rejection.
- Learners can view their request history.

### 4.4 Activation, renewal, and expiry

- Subscription duration starts on the actual admin approval/activation date.
- If an active learner receives another activation, the new duration extends the existing expiry date rather than discarding unused time.
- Paid access ends immediately at expiry.
- Expiry does not delete or disable the learner account, lesson history, or submitted exam history.

## 5. Course and Lesson Experience

### 5.1 Content organization

The default structure is:

**Course → Modules → Lessons**

Courses may optionally be associated with one or more exam categories and subjects. Classification is flexible; a course does not have to belong to exactly one examination.

### 5.2 Course lifecycle

- **Draft:** Admin-only; not visible in the public catalog.
- **Published:** Visible in the catalog and subject to the normal preview/subscription access rules.
- **Archived:** Removed from the active public catalog and retained for administrative and historical reference.

Archiving must preserve learner progress and historical records. Archiving is preferred over deleting content that has learner activity.

### 5.3 Lesson information and behavior

A lesson can include:
- Title.
- Video source/content reference.
- Description.
- Order within its module.
- Free-preview designation, with one preview lesson per course in the initial rules.

Admins can add, edit, reorder, and remove lessons. Video management is intended to support both uploaded video files and externally hosted video URLs in the eventual product. In the UI-only phase, these actions are simulated; no real video upload, transcoding, or streaming service is connected.

### 5.4 Learner learning experience

- Course cards show useful information such as title, thumbnail, subject/exam tags, and access state.
- Learners can see progress such as “3 of 12 lessons watched.”
- The lesson player includes the current lesson, course/module lesson navigation, and clear previous/next controls.
- The learner can resume from the last saved playback position in the eventual product.
- Playback progress is tracked automatically, while lesson completion can also be marked manually by the learner.
- Locked lessons show a lock indicator and a clear subscription call to action.
- Free preview lessons remain available to visitors and non-subscribed learners.

## 6. Tests and Examination Experience

The Tests area is a dedicated part of the platform. Visitors and learners can browse published tests and see which tests are free or subscription-locked.

### 6.1 Test classification

A test may be:
- Independent/standalone.
- Associated with an exam category.
- Associated with a subject.
- Optionally associated with a course.

### 6.2 Test configuration

Admins can configure:
- Test name and description.
- Publication state (published/unpublished).
- Whether the test is the designated free demo test.
- Duration and timing mode.
- Sections and question ordering.
- Question types.
- Marks for correct answers and penalties for incorrect answers.
- Attempt limit; unlimited attempts is the default.
- Results/answer-key release behavior.

The initial question types are:
1. **Single-correct MCQ:** One answer selected from radio options.
2. **Multi-select MCQ:** One or more answers selected from checkbox options.
3. **Numerical answer:** A numeric response entered using an on-screen input/keypad.

### 6.3 Examination timing

The admin can choose the timing model for each test:
- One overall countdown for the entire test; or
- Independent section timers.

For section-timed examinations, the product must define the behavior when a section timer reaches zero. The intended default is that the expired section becomes inaccessible and the learner continues only with sections that remain available. The exact navigation/locking policy should be confirmed in the detailed exam specification before backend implementation.

### 6.4 Examination marking

- Single-correct MCQ uses the configured correct and incorrect marks.
- Multi-select MCQ supports admin-configurable marking. The selected marking rule must be shown in the instructions before the test.
- Numerical answers support configurable precision, tolerance, and acceptable numeric formats.
- Unattempted questions receive the configured unattempted treatment, normally zero marks unless a test defines otherwise.

### 6.5 NTA-style examination interface

The exam experience is a central product feature and must have a focused, distraction-minimized layout.

**Before the exam — Instructions screen**
- Test duration and timing model.
- Section names and question counts.
- Available question types.
- Marking scheme, including negative marking.
- Question-palette color/status legend.
- Required acknowledgement: “I have read the instructions.”
- The learner must acknowledge the instructions before starting.

**During the exam — Exam screen**
- Question and answer area on the left/main area.
- Question palette on the right on larger screens.
- Section tabs across the top when the test has sections.
- Countdown timer pinned in the header.
- Question number and question content.
- Navigation controls.
- Direct navigation by selecting a question number in the palette.

**Question palette statuses**
- Grey: Not Visited.
- Red: Not Answered (visited, no saved response).
- Green: Answered.
- Purple: Marked for Review.
- Purple with a check: Answered and Marked for Review.

**Navigation actions**
- Save & Next.
- Clear Response.
- Mark for Review & Next.
- Back/Previous.
- Select a question from the palette.

Selecting an answer does not automatically advance to the next question. Marking a question for review preserves any selected response. Clearing a response removes the saved answer.

**Submission**
- Manual submission opens a confirmation dialog.
- The dialog summarizes answered, unanswered, and review-marked questions, grouped by section where applicable.
- When the overall timer reaches zero, the test is automatically submitted.
- Section-timer expiry follows the configured section-timing policy.

**Results and review**
- The score is shown immediately after submission.
- The initial result summary includes correct, incorrect, and unattempted counts and score breakdown.
- Detailed solutions/correct answers may be withheld until an admin releases them.
- Once released, answer review shows each question, the learner's response, the correct answer, and an explanation when available.

### 6.6 Attempts and history

- Attempt limits are configurable per test.
- Unlimited attempts is the default for practice tests.
- Learners can see attempt history and best score.
- Every submitted attempt must preserve the exact test version, questions, options, correct answers, marking rules, and relevant configuration used for that attempt. Later edits to a published test must not rewrite historical results.

### 6.7 Free demo test

There is exactly one designated free demo test for the initial product experience.
- It is publicly attemptable without registration.
- A visitor can complete the demo and see the result immediately.
- Signing in is optional; it is required to associate the attempt with a learner's personal history.
- All other regular tests require an active subscription to attempt.

## 7. Main User Journeys

### 7.1 Visitor discovers StudyVerse

1. Opens the marketing homepage.
2. Learns what StudyVerse offers and sees featured courses, the free demo test, and subscription information.
3. Browses courses and tests without signing in.
4. Opens a course and watches its designated free preview lesson, or starts the free demo test.
5. Is prompted to register/login when trying to access a restricted feature.

### 7.2 Visitor attempts the free demo

1. Opens the Tests catalog.
2. Selects the designated free demo test.
3. Reads and acknowledges the instructions.
4. Completes the examination.
5. Submits the test or is automatically submitted when the timer expires.
6. Views the immediate result.
7. May sign up/log in to retain the result in personal history.

### 7.3 Learner requests subscription activation

1. Registers or logs in.
2. Opens Subscribe.
3. Selects a duration and sees its configured price.
4. Pays outside StudyVerse through the accepted offline method.
5. Submits payment details and optionally attaches proof.
6. Sees the request as Pending.
7. Receives an Approved or Rejected status after admin review.
8. If approved, sees the active plan and expiry date; paid content becomes accessible.

### 7.4 Learner studies a course

1. Opens the course catalog.
2. Views course details and its modules/lessons.
3. Watches the free preview if not subscribed.
4. For full access, signs in and obtains an active subscription.
5. Opens lessons, resumes playback, navigates the lesson list, and tracks completion.
6. Sees course progress on the dashboard/course page.

### 7.5 Learner takes a regular test

1. Browses the Tests tab.
2. Opens a published test and views its details.
3. If not subscribed, sees a lock state and subscription call to action.
4. If subscribed, reads and acknowledges test instructions.
5. Completes the test using the exam interface and question palette.
6. Submits or is automatically submitted.
7. Sees the immediate score and, when released, detailed answer review.
8. Can later inspect attempt history and best score.

### 7.6 Admin manages content and subscribers

1. Signs in through the admin login.
2. Reviews dashboard counts and pending subscription requests.
3. Creates/edits courses, modules, and lessons.
4. Creates/edits tests, sections, questions, marking rules, and publication status.
5. Designates the one public demo test.
6. Reviews payment activation requests and approves/rejects them with the chosen duration or rejection reason.
7. Manages learner records and administrative permissions according to role.

## 8. Main Screens and Navigation

### 8.1 Public navigation

The public and learner-facing experience uses a top navigation bar containing:
- StudyVerse logo.
- Home.
- Courses.
- Tests.
- Subscribe (or subscription/plan status for a signed-in learner).
- Login/Sign up or profile menu.

### 8.2 Public pages

- Home/marketing landing page.
- Course catalog.
- Course details and lesson preview.
- Tests catalog.
- Test details and demo entry.
- Subscribe/pricing and activation request.
- Login.
- Sign up.
- Forgot/reset password.

### 8.3 Learner pages

- Learner dashboard.
- Courses/catalog and course detail.
- Lesson/video player.
- Tests/catalog and test details.
- Exam instructions.
- Active exam interface.
- Submission confirmation.
- Results and answer review.
- Attempt history.
- Subscription status and request history.
- Profile/account settings.

### 8.4 Admin pages

Admin uses a distinct side-navigation layout, visually separate from the learner experience.

- Admin dashboard.
- Course list/create/edit.
- Course module and lesson manager.
- Test list/create/edit.
- Test section and question builder.
- Learner directory and learner details.
- Subscription requests and activation review.
- Active/expired subscription records.
- Admin/staff management and permissions (Owner only).
- Admin account/profile settings.

## 9. UI-First Phase — Scope and Constraints

### 9.1 Immediate objective

The first deliverable is a polished, navigable UI prototype built with **Next.js**. The aim is to validate the product experience, screen hierarchy, visual design, interactions, and end-to-end user journeys before integrating a real database or production services.

### 9.2 Data strategy for this phase

- Use realistic fake/mock data for courses, modules, lessons, tests, questions, learners, subscriptions, requests, and exam attempts.
- Include a sample admin account for exploring the admin UI.
- Include at least one sample course with modules, lessons, and one free preview lesson.
- Include one demo test covering all three question types.
- Include representative regular tests that appear locked to a learner without an active subscription.
- Include mock learners with different subscription states: no subscription, pending request, active subscription, and expired subscription.
- Include mock exam attempts so result summaries, attempt history, and answer review can be designed.
- Simulate UI actions such as sign-in, role switching, course editing, test creation, request approval/rejection, activation, lesson completion, answering questions, and test submission.
- Mock interactions may update local/in-memory prototype state as appropriate, but they must not be represented as production persistence.
- Clearly label any simulated behavior that could otherwise be mistaken for a real transaction or backend action.

### 9.3 Explicitly excluded from the UI-first phase

- No real database connection or schema integration.
- No production backend/API integration.
- No real authentication provider or secure session management; sign-in and role behavior are prototype simulations.
- No real payment processing or payment verification.
- No real subscription activation or server-enforced access control.
- No actual video upload, storage, transcoding, DRM, or protected streaming integration.
- No production email, OTP, notification, or Google sign-in integration.
- No production analytics, monitoring, or background jobs.

These items may be considered in later phases after the UI and product behavior have been reviewed and approved.

### 9.4 UI prototype quality expectations

- Design for desktop, tablet, and mobile; the exam interface requires special attention on small screens.
- Keep public/learner layouts and admin layouts visually distinct but consistent with one StudyVerse design system.
- Provide realistic loading, empty, error, locked, pending, approved, rejected, expired, and success states where relevant.
- Use clear form validation and confirmation dialogs in simulated workflows.
- Ensure the exam palette, timer, question states, section navigation, and answer controls are coherent and usable.
- Avoid dead-end controls: all visible primary actions in the prototype should have a defined simulated outcome or be clearly marked as unavailable in the prototype.
- Preserve accessible contrast, readable typography, clear focus states, and keyboard-friendly interaction patterns.

## 10. Product Design Principles

1. **Learning first:** Learners should be able to find the next useful learning action quickly.
2. **Low-friction discovery:** Browsing courses, previews, and the free demo must not require account creation.
3. **Clear access boundaries:** Locked content must explain why it is locked and what the learner can do to unlock it.
4. **Exam familiarity:** The exam interface should feel familiar to learners who have used Indian computer-based competitive examinations.
5. **Trustworthy results:** Submitted attempts and their scoring context must remain historically consistent.
6. **Admin efficiency:** Content and subscription-management tasks should be straightforward and predictable.
7. **Responsive by design:** Core learning and examination flows must remain usable on phones, not just desktop computers.
8. **No premature complexity:** The UI-first phase validates screens and flows without committing to unconfirmed backend or infrastructure choices.

## 11. Success Criteria for the UI-First Phase

The UI prototype is ready for product review when a reviewer can explore these journeys using fake data:

- Visitor lands on the homepage and browses courses/tests.
- Visitor watches a free preview lesson.
- Visitor completes the free demo test without signing in and sees a result.
- Visitor signs up/logs in through a simulated flow and is routed to the intended destination or learner dashboard.
- Non-subscribed learner sees locked full lessons and regular tests with a clear activation CTA.
- Learner submits a simulated activation request and sees Pending status.
- Admin reviews a pending request, approves/rejects it, and the learner-facing mock status updates.
- Active learner accesses full lessons and regular tests.
- Learner can resume a lesson, see progress, and manually mark completion.
- Learner completes an exam containing single-correct, multi-select, and numerical questions.
- Exam timer, section navigation, palette statuses, clear response, review marking, submission confirmation, result summary, and answer review can be demonstrated.
- Admin can create/edit/archive a course and manage its modules and lessons in the prototype.
- Admin can create/edit/publish/unpublish a test and configure sections, question types, and marking rules in the prototype.
- Admin and staff permissions are represented clearly in the UI.
- Important empty, loading, validation, locked, pending, error, and success states are represented.

## 12. Decisions Still Open

The following are deliberately not decided in this product brief and should be addressed in later discovery before production implementation:

- Detailed Next.js application structure and rendering strategy.
- Backend architecture and API conventions.
- Database choice, schema, indexing, and migrations.
- Authentication provider and production session/security design.
- Video hosting, processing, delivery, and access protection provider.
- File/object storage provider and upload limits.
- Hosting, domains, environments, deployment, and CI/CD.
- Email/notification provider and event delivery rules.
- Production logging, analytics, error monitoring, and alerting.
- Security controls, rate limits, abuse prevention, and privacy/retention policy details.
- Exact section-timer expiry behavior and whether learners can revisit completed sections.
- Whether demo attempts by anonymous visitors are retained, and for how long, before sign-in.
- Final policy for account deletion and retention of payment, subscription, and examination records.
- Final test scheduling/release policies and any future scheduled mock-exam mode.
- Explicit Phase 1 exclusions beyond the UI-first constraints above.

---

## 13. Current Product Direction

**Build the StudyVerse experience first, using Next.js and realistic mock data.** Validate the public discovery flow, learner dashboard, course and video-learning experience, subscription request journey, admin workspace, and especially the complete NTA-style examination journey.

Do not integrate a real database or production services during this UI-design phase. Architecture and service selection remain a separate discussion after the product experience has been reviewed.
