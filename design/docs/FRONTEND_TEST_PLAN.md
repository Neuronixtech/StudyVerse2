# StudyVerse — Frontend Test Plan

**Document:** `FRONTEND_TEST_PLAN.md`  
**Product:** StudyVerse  
**Scope:** Next.js frontend, simulated workflows, responsive layout and accessibility  
**Status:** Proposed test plan for implementation and review  
**Version:** 1.0  
**Last updated:** 24 November 2026

---

## 1. Purpose

This document defines how the StudyVerse Next.js frontend will be tested before it is connected to production backend services. The objective is to verify the visitor, learner and admin experiences end to end—not merely whether routes render.

The catalogue covers public discovery, simulated authentication, subscription states, courses and lessons, video-player UI, the NTA-style examination experience, admin content management, bookstore workflows, responsive behavior, accessibility, and loading/error states.

This is a **frontend test plan**. It does not certify backend security, database correctness, real payment receipt, production video authorization, or persistence.

## 2. Product scope and source assumptions

This plan follows the current StudyVerse product documents:

- `PLAN.md`: India-focused, English-only learning platform; Course → Modules → Lessons; one designated free-preview lesson per course; one free demo test available without registration; full lessons and regular tests require an active all-access subscription; Owner and Staff Admin roles; lesson progress/resume; NTA-style exam interface.
- `BOOKSTORE_SPEC.md`: public bookstore browsing; checkout requires login but not an active learning subscription; physical books, cart, manual payment workflow, order tracking, admin inventory and fulfilment.
- `STUDYVERSE_VIDEO_PIPELINE_SPEC.md`: future production video pipeline. Actual upload, transcoding, HLS delivery and protected playback are not part of the current UI prototype.
- `Backend_architecture.md`: proposed later production backend architecture. It does not change the mock-only scope of the current frontend phase.

The UI prototype uses deterministic mock data and simulated interactions. No real database, backend API, authentication provider, payment processor, video service, email sender, or courier integration is assumed.

## 3. Objectives

1. Verify every implemented route and its navigation behavior.
2. Verify visitor, unauthenticated, non-subscribed, pending, active and expired learner states.
3. Verify simulated sign-in, sign-up, logout and role changes.
4. Verify course discovery, lesson navigation, progress and resume UI.
5. Verify all exam question types, palette states, sections, timers, submission and result presentation.
6. Verify admin course/test workflows and permission-aware actions.
7. Verify bookstore browsing, guest cart, login continuation, checkout and simulated order lifecycle.
8. Verify desktop, tablet and mobile behavior.
9. Verify accessibility basics and recoverable UI error states.
10. Make tests deterministic, independent and repeatable.

## 4. Out of scope

The following require backend/API, integration, security or operational tests after the production backend exists:

- Real password hashing, OAuth, sessions, account recovery and server-side authorization.
- Real subscription activation, expiry enforcement and renewal transactions.
- Real payment processing, UPI/bank reconciliation, invoice generation and refunds.
- Server-authoritative exam deadlines, scoring, anti-cheating controls and concurrent submissions.
- Actual video uploads, multipart resumability, FFmpeg processing, HLS delivery, playback-token enforcement or DRM.
- Database persistence, backup and recovery.
- Real email, SMS, push notification and courier delivery.
- Concurrent inventory reservations and oversell prevention.

A mock success message must never be treated as evidence that an external transaction actually occurred.

## 5. Testing strategy and tools

| Layer | Purpose | Recommended tool |
|---|---|---|
| Unit | Pure functions, validation, calculations and state transitions | Vitest |
| Component | User-visible behavior and interactions | Vitest + React Testing Library |
| End-to-end | Complete journeys in a real browser | Playwright |
| Accessibility | Automated checks plus keyboard-focused tests | axe-core with Playwright/RTL |
| Exploratory | Visual quality, unusual interaction paths and device spot checks | Manual browser/device testing |

Confirm the installed Next.js, React and package-manager versions during the frontend audit before installing/upgrading test dependencies. Use Playwright for async Server Component behavior and full navigation journeys. Do not use snapshots as the primary correctness strategy.

### What belongs at each layer

**Unit tests:** exam palette mapping, progress calculations, price/discount calculations, cart totals, date display, validation helpers, and subscription-state selectors.

**Component tests:** forms, navigation, subscription cards, course cards, lesson list, mocked player controls, question palette, question inputs, exam confirmation dialog, admin forms and bookstore cart/checkout components.

**E2E tests:** visitor preview, free demo, subscription-state journeys, exam completion, admin course/test management, permission denial and bookstore checkout.

**Accessibility tests:** labels, keyboard access, visible focus, dialog focus management, landmarks/headings, status labels and contrast.

### Browser coverage

- Chromium on every pull request.
- Firefox and WebKit on scheduled or pre-release regression runs.
- Desktop E2E for critical journeys.
- Mobile emulation for public navigation, player, exam and checkout.
- Tablet coverage for representative learner/admin pages.
- Manual spot checks on at least one iOS Safari device and one Android Chrome device before launch.

Emulation is not a full substitute for testing real devices.

## 6. Priority definitions

| Priority | Meaning | Release expectation |
|---|---|---|
| P0 — Critical | Core navigation, learning access-state, exam flow, critical admin permission or core shopping journey | Must pass before prototype acceptance |
| P1 — High | Important supporting workflow or secondary feature | Must pass before the relevant feature is accepted |
| P2 — Normal | Lower-risk edge state, convenience or visual behavior | Track and resolve according to impact |

Priority does not determine implementation order. A P0 case can be blocked by an unfinished feature, but must pass before that journey is accepted.

## 7. Test IDs and case format

IDs use `<AREA>-<NUMBER>` and must appear in automated test titles or annotations.

| Prefix | Area |
|---|---|
| PUB | Public website and navigation |
| AUTH | Authentication UI |
| SUB | Subscription and access-state UI |
| COURSE | Course catalog and lesson experience |
| VID | Video player and simulated progress |
| EXAM | Test catalog, exam flow and results |
| ADMIN | Admin course/test management and permissions |
| BOOK | Bookstore customer journey |
| BOOKADM | Bookstore administration |
| RESP | Responsive behavior |
| A11Y | Accessibility |
| STATE | Loading, empty, error and resilience states |

Each test case below specifies priority, layer, preconditions, steps and expected result.

## 8. Deterministic test fixtures

### 8.1 User fixtures

| Fixture | State | Expected access |
|---|---|---|
| `visitor` | Unauthenticated | Public catalog, designated previews and free demo |
| `learnerNoSubscription` | Learner; no subscription | Public catalog, previews and free demo; full lessons/regular tests locked |
| `learnerPending` | Learner; activation request pending | Same paid-content restriction as no subscription |
| `learnerActive` | Learner; active subscription | Published full lessons and regular tests available |
| `learnerExpired` | Learner; expired subscription | Paid access locked; historical records retained |
| `owner` | Owner | Full admin UI |
| `staffCourseManager` | Staff with course permissions | Only configured course permissions |
| `staffLimited` | Staff with restricted permissions | Restricted admin actions |

Visitor is an anonymous state, not a stored account role.

### 8.2 Course fixtures

Include published, draft and archived courses; multiple modules and ordered lessons; one preview lesson per course; lessons in locked, preview, in-progress and completed display states; and enough lessons to exercise previous/next navigation and progress summaries.

### 8.3 Exam fixtures

Include exactly one free demo test; multiple regular tests; all three question types; a multi-section test; overall-timer and section-timer tests; all five question-palette states; attempts with answered, unanswered and review states; known scoring fixtures; and results with solutions both unreleased and released.

### 8.4 Bookstore fixtures

Include available, low-stock and out-of-stock products; products with multiple images and optional metadata missing; guest and learner carts; and orders in pending payment, verification, confirmed, processing, shipped, delivered, cancelled and returned states.

### 8.5 Fixture rules

- Use stable fixture IDs and deterministic ordering.
- Control time for timers, expiry and return-window tests.
- Reset mock state before every test; clone mutable fixtures before mutation.
- Do not rely on another test having run first.
- Do not use live Google login, email, payment, video-origin or courier services.
- Never use production user data.
- External network calls should be disabled or mocked in unit/component tests.

---

# 9. Test case catalogue

## 9.1 Public website and navigation

### PUB-001 — Homepage loads for visitor
- **Priority / layer:** P0 / E2E
- **Preconditions:** App running; user unauthenticated.
- **Steps:** Open homepage; inspect primary content and navigation; scroll page.
- **Expected:** Homepage renders without login; primary sections and navigation are visible; no runtime error or broken critical asset.

### PUB-002 — Public navigation links work
- **Priority / layer:** P0 / E2E
- **Preconditions:** Visitor is on homepage.
- **Steps:** Open Home, Courses and Tests; use browser Back and Forward.
- **Expected:** Correct routes load; history works; active navigation state is accurate.

### PUB-003 — Course catalog is public
- **Priority / layer:** P0 / E2E
- **Preconditions:** Published, draft and archived course fixtures exist.
- **Steps:** Open Courses while unauthenticated.
- **Expected:** Published courses appear; draft and archived courses are not shown as publicly available.

### PUB-004 — Course detail opens from catalog
- **Priority / layer:** P0 / E2E
- **Preconditions:** At least one published course exists.
- **Steps:** Select a course card.
- **Expected:** Matching detail page shows correct title, description, classifications and module/lesson information.

### PUB-005 — Visitor can inspect course details
- **Priority / layer:** P0 / E2E
- **Preconditions:** Visitor opened a published course.
- **Steps:** Inspect course description, module list and lesson titles.
- **Expected:** Public course information is visible without sign-in; paid lesson access is still clearly restricted.

### PUB-006 — Archived course is not publicly discoverable
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Archived course fixture exists.
- **Steps:** Browse catalog; open archived course's direct route.
- **Expected:** Archived course is absent from active catalog; direct route does not present it as publicly published.

### PUB-007 — Unknown route displays not-found state
- **Priority / layer:** P1 / E2E
- **Preconditions:** App running.
- **Steps:** Navigate to a nonexistent route.
- **Expected:** Useful not-found screen and route back to public site; no blank page or raw exception.

### PUB-008 — Deep link survives refresh
- **Priority / layer:** P0 / E2E
- **Preconditions:** Valid public course detail URL exists.
- **Steps:** Open URL directly; refresh.
- **Expected:** Same route renders correctly after refresh without prior homepage navigation.

## 9.2 Authentication UI

These cases verify mock authentication behavior only, not real password/OAuth/session security.

### AUTH-001 — Login screen renders
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Visitor unauthenticated.
- **Steps:** Open Login from navigation or protected-action prompt.
- **Expected:** Email/password inputs, submit action and relevant links are visible and labelled.

### AUTH-002 — Empty login form shows validation
- **Priority / layer:** P0 / Component
- **Preconditions:** Login form displayed.
- **Steps:** Submit without entering fields.
- **Expected:** Required-field errors appear; no mock login occurs.

### AUTH-003 — Invalid email format is rejected
- **Priority / layer:** P1 / Component
- **Preconditions:** Login form displayed.
- **Steps:** Enter malformed email and non-empty password; submit.
- **Expected:** Email validation appears; form does not report success.

### AUTH-004 — Mock successful login routes to learner destination
- **Priority / layer:** P0 / E2E
- **Preconditions:** Valid learner fixture exists in mock auth service.
- **Steps:** Enter fixture credentials; submit.
- **Expected:** Mock user state changes to learner; intended destination loads; navigation reflects signed-in state.

### AUTH-005 — Signup validates required fields
- **Priority / layer:** P1 / Component
- **Preconditions:** Signup page displayed.
- **Steps:** Submit empty fields; submit malformed email or mismatched password confirmation if supported.
- **Expected:** Field errors appear; no malformed account is added to mock state.

### AUTH-006 — Mock signup completes
- **Priority / layer:** P1 / E2E
- **Preconditions:** Mock signup flow available.
- **Steps:** Enter valid fixture data; submit.
- **Expected:** Documented simulated next state occurs; UI does not claim real email delivery or production account creation.

### AUTH-007 — Google login has truthful prototype state
- **Priority / layer:** P1 / Component
- **Preconditions:** Login screen displayed.
- **Steps:** Activate Google sign-in control.
- **Expected:** Clearly simulated result or explicit unavailable-in-prototype message; no claim that real OAuth occurred.

### AUTH-008 — Logout returns to visitor state
- **Priority / layer:** P0 / E2E
- **Preconditions:** Learner fixture signed in.
- **Steps:** Open profile menu; select Logout.
- **Expected:** Mock auth state is cleared; public navigation returns; learner-only controls disappear.

### AUTH-009 — Protected route prompts visitor
- **Priority / layer:** P0 / E2E
- **Preconditions:** Visitor unauthenticated; learner-only route exists.
- **Steps:** Open learner-only URL directly.
- **Expected:** Login prompt or redirect appears; signed-in learner view is not shown.

## 9.3 Subscription and access-state UI

### SUB-001 — Subscription durations and prices render
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Plan fixtures include 30, 90 and 365 days.
- **Steps:** Open Subscribe.
- **Expected:** Durations, configured prices and plan information are displayed consistently.

### SUB-002 — Selecting a plan updates selection
- **Priority / layer:** P1 / Component
- **Preconditions:** Subscribe screen displayed.
- **Steps:** Select each duration.
- **Expected:** Intended option is selected; displayed duration and price match selected fixture.

### SUB-003 — Learner submits activation request
- **Priority / layer:** P0 / E2E
- **Preconditions:** `learnerNoSubscription` signed in; mock request flow available.
- **Steps:** Select duration; enter mock payment method, amount and reference; submit.
- **Expected:** Request appears as Pending; paid access remains locked; simulation is clear.

### SUB-004 — Pending request is visible to learner
- **Priority / layer:** P0 / E2E
- **Preconditions:** `learnerPending` has pending request.
- **Steps:** Open subscription status/history.
- **Expected:** Pending status and request details appear; paid access remains restricted.

### SUB-005 — Admin approval changes mock learner access
- **Priority / layer:** P0 / E2E
- **Preconditions:** Owner/admin and pending learner fixtures exist.
- **Steps:** Admin opens request and approves with duration; switch to learner fixture.
- **Expected:** Learner sees Active and configured expiry; mock paid content is unlocked.

### SUB-006 — Rejected request displays reason
- **Priority / layer:** P0 / E2E
- **Preconditions:** Pending request exists.
- **Steps:** Admin rejects with reason; inspect learner request history.
- **Expected:** Rejected status and reason appear; paid access remains locked.

### SUB-007 — Rejected learner can submit a new request
- **Priority / layer:** P1 / E2E
- **Preconditions:** Learner has rejected request and no pending request.
- **Steps:** Submit a new activation request.
- **Expected:** New request appears in mock state; rejected historical request remains visible.

### SUB-008 — Non-subscribed learner sees paid lesson lock
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** `learnerNoSubscription` signed in.
- **Steps:** Open course; select non-preview lesson.
- **Expected:** Locked state and subscription CTA appear; inaccessible lesson is not presented as playable.

### SUB-009 — Active learner sees full lesson access
- **Priority / layer:** P0 / E2E
- **Preconditions:** `learnerActive` signed in.
- **Steps:** Open published course; select full lesson.
- **Expected:** Player screen is available and indicates access in the mock UI.

### SUB-010 — Expired learner retains history but sees paid locks
- **Priority / layer:** P0 / E2E
- **Preconditions:** `learnerExpired` has historical progress and attempts.
- **Steps:** Open paid lesson; open progress and exam history.
- **Expected:** Paid lesson locked; historical progress and exam records remain visible.

### SUB-011 — Renewal extends displayed expiry
- **Priority / layer:** P1 / Component + E2E
- **Preconditions:** Active learner has known expiry; mock renewal available.
- **Steps:** Simulate approval of another subscription period.
- **Expected:** Displayed expiry follows extension rule; previous subscription history is preserved.

### SUB-012 — Bookstore is not gated by learning subscription
- **Priority / layer:** P0 / E2E
- **Preconditions:** Learner has no active subscription.
- **Steps:** Open Bookstore; add an available book; continue to checkout.
- **Expected:** Store browsing and checkout are available; learning subscription paywall does not block purchase.

## 9.4 Course and lesson experience

### COURSE-001 — Modules and lessons display in correct order
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Course fixture contains multiple ordered modules and lessons.
- **Steps:** Open course detail.
- **Expected:** Modules and lessons appear in configured order with correct labels/statuses.

### COURSE-002 — Draft course is visible to admin only
- **Priority / layer:** P0 / E2E
- **Preconditions:** Draft course, visitor and admin fixtures exist.
- **Steps:** Inspect public catalog; inspect admin course list.
- **Expected:** Draft is absent publicly and present in admin management.

### COURSE-003 — Published course appears publicly
- **Priority / layer:** P0 / E2E
- **Preconditions:** Draft course exists.
- **Steps:** Admin publishes course; inspect public catalog.
- **Expected:** Course appears in mock public catalog with configured content.

### COURSE-004 — Archive removes public visibility
- **Priority / layer:** P0 / E2E
- **Preconditions:** Published course exists.
- **Steps:** Admin archives course; inspect public and admin lists.
- **Expected:** Course is removed from active public catalog and retained in admin archived view.

### COURSE-005 — Free-preview designation is clear
- **Priority / layer:** P0 / Component
- **Preconditions:** Course has one designated preview lesson.
- **Steps:** Inspect lesson list as visitor and non-subscribed learner.
- **Expected:** Preview is identified; paid lessons show appropriate locked states.

### COURSE-006 — Next lesson navigation
- **Priority / layer:** P1 / Component + E2E
- **Preconditions:** Learner can access current and next lessons.
- **Steps:** Open lesson; select Next Lesson.
- **Expected:** Correct next lesson loads and course/module context updates.

### COURSE-007 — Previous lesson navigation
- **Priority / layer:** P1 / Component
- **Preconditions:** Current lesson has a previous lesson.
- **Steps:** Select Previous Lesson.
- **Expected:** Correct previous lesson loads and lesson list selection updates.

### COURSE-008 — First/last lesson navigation boundaries
- **Priority / layer:** P1 / Component
- **Preconditions:** Course has multiple lessons.
- **Steps:** Inspect Previous at first lesson and Next at last lesson.
- **Expected:** Boundary controls are disabled, hidden or behave according to the UI specification; no invalid index is loaded.

### COURSE-009 — Course progress summary is accurate
- **Priority / layer:** P0 / Unit + Component
- **Preconditions:** Fixture has known completed/total lesson counts.
- **Steps:** Inspect course card and detail page.
- **Expected:** Counts and percentage match fixture data with consistent rounding.

### COURSE-010 — Lesson list reflects completion state
- **Priority / layer:** P1 / Component
- **Preconditions:** Fixture includes completed, in-progress and not-started lessons.
- **Steps:** Open lesson list.
- **Expected:** Each state is distinguishable and accessible beyond color alone.

## 9.5 Video player and simulated progress

These cases use a mocked media/player adapter. They do not test actual HLS, upload, playback-token security or media delivery.

### VID-001 — Player renders selected lesson
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Accessible lesson has mock video source.
- **Steps:** Open lesson.
- **Expected:** Player area, lesson title and course/module context are displayed.

### VID-002 — Basic player controls update mock state
- **Priority / layer:** P1 / Component
- **Preconditions:** Mock player loaded.
- **Steps:** Activate play/pause and seek controls where implemented.
- **Expected:** Control state and displayed position update consistently without real media service.

### VID-003 — Resume position is restored
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Learner fixture has saved position for active asset version.
- **Steps:** Open lesson player.
- **Expected:** Mock player initializes at saved position, clamped to valid duration.

### VID-004 — Progress updates lesson summary
- **Priority / layer:** P0 / Component
- **Preconditions:** Lesson is incomplete and mock progress can be changed.
- **Steps:** Advance playback position; inspect course progress.
- **Expected:** Progress changes according to configured fixture rule.

### VID-005 — Manual lesson completion works
- **Priority / layer:** P1 / Component + E2E
- **Preconditions:** Lesson is incomplete and manual completion action exists.
- **Steps:** Activate Mark Complete.
- **Expected:** Lesson becomes complete in mock state and course summary updates.

### VID-006 — Completed lesson can be reopened
- **Priority / layer:** P1 / E2E
- **Preconditions:** Lesson is complete and learner is entitled.
- **Steps:** Reopen lesson.
- **Expected:** Lesson remains accessible; completed state is retained.

### VID-007 — Locked lesson does not expose active player controls
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Non-subscribed learner opens non-preview lesson.
- **Steps:** Open lesson route.
- **Expected:** Lock explanation/CTA appears; usable playback controls are not presented.

### VID-008 — Player shows recoverable error state
- **Priority / layer:** P1 / Component
- **Preconditions:** Mock media adapter returns an error.
- **Steps:** Open lesson player.
- **Expected:** Useful error and retry/back action appear; page does not crash or go blank.

### VID-009 — Mobile player layout is usable
- **Priority / layer:** P0 / Playwright responsive
- **Preconditions:** Mobile viewport and accessible lesson fixture.
- **Steps:** Open player; inspect controls, title and lesson navigation.
- **Expected:** Controls are tappable; important content is not clipped; no horizontal page overflow.

## 9.6 Examination system

Exam cases receive the most thorough coverage. Question state must remain consistent across response selection, navigation, review and submission.

### EXAM-001 — Free demo is visible to visitor
- **Priority / layer:** P0 / E2E
- **Preconditions:** Exactly one free demo test is published.
- **Steps:** Open Tests as visitor.
- **Expected:** Demo is clearly identified and can be opened without login.

### EXAM-002 — Visitor starts demo without registration
- **Priority / layer:** P0 / E2E
- **Preconditions:** Visitor selected demo test.
- **Steps:** Read instructions; acknowledge; start.
- **Expected:** Exam screen opens without account creation.

### EXAM-003 — Regular test is locked for non-subscribed learner
- **Priority / layer:** P0 / E2E
- **Preconditions:** `learnerNoSubscription` signed in; regular test published.
- **Steps:** Open details; attempt to start.
- **Expected:** Subscription restriction and CTA appear; exam does not start.

### EXAM-004 — Active learner starts regular test
- **Priority / layer:** P0 / E2E
- **Preconditions:** `learnerActive` signed in.
- **Steps:** Open regular test; acknowledge instructions; start.
- **Expected:** Exam opens with correct title, duration, sections and marking information.

### EXAM-005 — Instructions must be acknowledged
- **Priority / layer:** P0 / Component
- **Preconditions:** Test instructions screen displayed.
- **Steps:** Attempt start without acknowledgement; acknowledge and start.
- **Expected:** First attempt is blocked; second starts exam.

### EXAM-006 — Single-correct answer selection
- **Priority / layer:** P0 / Component
- **Preconditions:** Current question is single-correct MCQ.
- **Steps:** Select one option; inspect response and question status.
- **Expected:** Exactly one option selected; answer retained; question is Answered.

### EXAM-007 — Single-correct answer can be changed
- **Priority / layer:** P1 / Component
- **Preconditions:** Single-correct question has selected answer.
- **Steps:** Select another option.
- **Expected:** Previous option is deselected; only new option remains selected.

### EXAM-008 — Multi-select answer selection
- **Priority / layer:** P0 / Component
- **Preconditions:** Current question is multi-select.
- **Steps:** Select several options; deselect one.
- **Expected:** Multiple selections are preserved; deselected option is removed; question status remains correct.

### EXAM-009 — Numerical answer is retained
- **Priority / layer:** P0 / Component
- **Preconditions:** Numerical question displayed.
- **Steps:** Enter valid numeric answer; navigate away and back.
- **Expected:** Numeric response is retained and displayed correctly.

### EXAM-010 — Numerical input validates invalid characters
- **Priority / layer:** P1 / Component
- **Preconditions:** Numerical question displayed.
- **Steps:** Enter alphabetic/disallowed characters.
- **Expected:** Invalid input is prevented or clearly validated; accepted numeric input is not silently corrupted.

### EXAM-011 — Save & Next preserves response
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Question supports response and a next question exists.
- **Steps:** Answer; select Save & Next; navigate back.
- **Expected:** Next question opens; original response remains.

### EXAM-012 — Clear Response removes response
- **Priority / layer:** P0 / Component
- **Preconditions:** Current question has answer.
- **Steps:** Select Clear Response.
- **Expected:** Response is removed; question status becomes visited/not-answered as specified; review behavior remains consistent.

### EXAM-013 — Mark for Review & Next
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Current question unanswered; next question exists.
- **Steps:** Select Mark for Review & Next; revisit via palette.
- **Expected:** Question is review-marked; next opens; first remains accessible.

### EXAM-014 — Answered and marked for review
- **Priority / layer:** P0 / Unit + Component
- **Preconditions:** Current question has answer.
- **Steps:** Answer; mark for review; inspect palette; revisit.
- **Expected:** Answer retained; distinct purple-with-check state appears; response remains editable.

### EXAM-015 — Direct question palette navigation
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Test contains multiple questions.
- **Steps:** Select another question number from palette.
- **Expected:** Correct question opens; other answers and statuses remain unchanged.

### EXAM-016 — Palette displays all five required states
- **Priority / layer:** P0 / Unit + Component
- **Preconditions:** Fixture includes not visited, not answered, answered, review and answered-plus-review states.
- **Steps:** Open palette.
- **Expected:** Correct state is displayed for every question and has an accessible label; color is not the only indicator.

### EXAM-017 — Previous/Next boundary behavior
- **Priority / layer:** P1 / Component
- **Preconditions:** Exam has first and last questions.
- **Steps:** Inspect Previous on first and Next on last question.
- **Expected:** Boundary follows defined UI behavior; no invalid question index is loaded.

### EXAM-018 — Section navigation changes question set
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Test has at least two sections.
- **Steps:** Switch sections; select a question in each.
- **Expected:** Correct questions/statuses appear; responses in other sections remain intact.

### EXAM-019 — Overall timer displays correctly
- **Priority / layer:** P0 / Component
- **Preconditions:** Overall timer test active; clock controllable.
- **Steps:** Start; advance mocked clock.
- **Expected:** Timer decreases accurately, stays visible and never displays invalid negative time.

### EXAM-020 — Section timer displays correct section time
- **Priority / layer:** P1 / Component
- **Preconditions:** Section-timer test active.
- **Steps:** Start; navigate sections; advance controlled clock.
- **Expected:** Timer corresponds to configured section and does not reset unexpectedly on navigation.

### EXAM-021 — Timer expiry triggers configured UI behavior
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Controlled clock; timer near expiry.
- **Steps:** Advance clock to zero.
- **Expected:** Overall timer invokes configured auto-submit flow; section timer follows configured section-expiry behavior.

### EXAM-022 — Submission summary is accurate
- **Priority / layer:** P0 / Component
- **Preconditions:** Attempt has answered, unanswered and review-marked questions.
- **Steps:** Select Submit.
- **Expected:** Confirmation shows accurate counts, and section-wise counts where supported.

### EXAM-023 — Cancel submission returns to exam
- **Priority / layer:** P0 / Component
- **Preconditions:** Submission dialog open.
- **Steps:** Select Cancel/Continue Exam.
- **Expected:** Dialog closes; exam remains active; responses and statuses are unchanged.

### EXAM-024 — Confirm submission displays result
- **Priority / layer:** P0 / E2E
- **Preconditions:** Attempt has saved responses.
- **Steps:** Open confirmation; confirm submission.
- **Expected:** Mock attempt ends; result screen appears; exam controls become read-only.

### EXAM-025 — Result counts and score summary are consistent
- **Priority / layer:** P0 / Unit + Component
- **Preconditions:** Known answer key and marking fixture exists.
- **Steps:** Submit fixture attempt; inspect score and answer counts.
- **Expected:** Display matches expected fixture result and marking scheme.

### EXAM-026 — Answer explanations respect release state
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** One result has solutions unreleased; another has solutions released.
- **Steps:** Open both review screens.
- **Expected:** Correct answers/explanations are withheld or shown according to release state.

### EXAM-027 — Attempt history displays prior attempts
- **Priority / layer:** P1 / E2E
- **Preconditions:** Learner has multiple attempts.
- **Steps:** Open attempt history.
- **Expected:** Correct test, date, score and status appear in intended order.

### EXAM-028 — Refresh during active mock attempt
- **Priority / layer:** P1 / E2E
- **Preconditions:** Mock attempt has saved answers and defined resume behavior.
- **Steps:** Answer questions; refresh page.
- **Expected:** Defined mock persistence behavior occurs; in-memory state is not falsely described as server persistence.

### EXAM-029 — Repeated submit does not duplicate result
- **Priority / layer:** P1 / Component
- **Preconditions:** Attempt already submitted.
- **Steps:** Trigger submit again using any remaining control/route.
- **Expected:** No second result is created; submitted state remains read-only.

### EXAM-030 — Exam layout is usable on mobile
- **Priority / layer:** P0 / Playwright responsive
- **Preconditions:** Mobile viewport and active mock exam.
- **Steps:** Navigate questions; open palette; answer; switch section; submit.
- **Expected:** Timer, questions, palette and primary actions remain accessible without page-wide horizontal overflow or clipping.

## 9.7 Admin learning-content and test management

### ADMIN-001 — Admin dashboard renders
- **Priority / layer:** P0 / E2E
- **Preconditions:** Owner fixture signed in.
- **Steps:** Open Admin Dashboard.
- **Expected:** Dashboard and configured metrics render without errors.

### ADMIN-002 — Create course draft
- **Priority / layer:** P0 / E2E
- **Preconditions:** Owner or authorized Staff fixture signed in.
- **Steps:** Complete required fields; save as Draft.
- **Expected:** Course appears in admin list as Draft and not in public catalog.

### ADMIN-003 — Course form validates required fields
- **Priority / layer:** P1 / Component
- **Preconditions:** Course creation form open.
- **Steps:** Submit empty required fields and invalid values.
- **Expected:** Field validation appears; invalid course is not added to mock state.

### ADMIN-004 — Add and reorder modules
- **Priority / layer:** P1 / Component + E2E
- **Preconditions:** Editable draft course exists.
- **Steps:** Add multiple modules; reorder them.
- **Expected:** Chosen order is reflected; modules remain attached to correct course.

### ADMIN-005 — Add and reorder lessons
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Course has at least one module.
- **Steps:** Add lessons; change order; inspect course view.
- **Expected:** Lesson order and module association are correct.

### ADMIN-006 — Designate free-preview lesson
- **Priority / layer:** P0 / Component
- **Preconditions:** Course has multiple lessons.
- **Steps:** Mark one preview; try to mark another.
- **Expected:** One-preview-per-course rule is represented and conflicting designation is prevented or explicitly resolved.

### ADMIN-007 — Publish and archive course
- **Priority / layer:** P0 / E2E
- **Preconditions:** Draft and published courses exist.
- **Steps:** Publish draft; archive published course.
- **Expected:** Status transitions are visible; public catalog reflects them correctly.

### ADMIN-008 — Create test with all question types
- **Priority / layer:** P0 / E2E
- **Preconditions:** Authorized admin signed in.
- **Steps:** Create draft test; add single, multi-select and numerical questions.
- **Expected:** Correct editor is shown for each type and test preview reflects them.

### ADMIN-009 — Configure sections, timing and marking
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Draft test exists.
- **Steps:** Configure sections, timer model, marks, penalties and result-release settings.
- **Expected:** Preview/instructions consistently reflect saved mock configuration.

### ADMIN-010 — Publish test
- **Priority / layer:** P0 / E2E
- **Preconditions:** Draft test has valid sections/questions.
- **Steps:** Publish test.
- **Expected:** Test appears in appropriate catalog; demo/subscription access state is correct.

### ADMIN-011 — Editing published test communicates versioning
- **Priority / layer:** P1 / Component
- **Preconditions:** Published test exists.
- **Steps:** Edit published test.
- **Expected:** UI communicates new-version behavior or protected historical context; old attempts are not visually rewritten.

### ADMIN-012 — Owner can manage Staff
- **Priority / layer:** P0 / E2E
- **Preconditions:** Owner signed in.
- **Steps:** Open staff management; inspect invite and permission controls.
- **Expected:** Owner-only staff actions are available.

### ADMIN-013 — Staff cannot access Owner-only settings
- **Priority / layer:** P0 / E2E
- **Preconditions:** `staffLimited` signed in.
- **Steps:** Open Owner-only settings via sidebar and direct URL.
- **Expected:** Owner-only actions are unavailable or access-denied; no unauthorized mock mutation occurs.

### ADMIN-014 — Staff actions reflect assigned permissions
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** `staffCourseManager` and `staffLimited` fixtures exist.
- **Steps:** Compare course and subscription management actions.
- **Expected:** Each sees only actions allowed by the fixture permission set.

### ADMIN-015 — Admin loading/empty/error states are usable
- **Priority / layer:** P1 / Component
- **Preconditions:** Admin list supports loading, empty and error mock states.
- **Steps:** Render each state.
- **Expected:** Helpful loader, empty message and recoverable error appear; no blank dead-end screen.

## 9.8 Bookstore customer experience

### BOOK-001 — Bookstore is public and subscription-independent
- **Priority / layer:** P0 / E2E
- **Preconditions:** Visitor or learner without active subscription.
- **Steps:** Open Bookstore from main navigation.
- **Expected:** Storefront is accessible without learning-subscription gate.

### BOOK-002 — Search by title, author and ISBN
- **Priority / layer:** P1 / Component + E2E
- **Preconditions:** Product fixtures have distinct title, author and ISBN values.
- **Steps:** Search each supported field.
- **Expected:** Matching products appear; non-matches are excluded; clearing search restores catalog.

### BOOK-003 — Filters and sorting work
- **Priority / layer:** P1 / Component
- **Preconditions:** Products vary by price, availability, publisher, arrival and popularity.
- **Steps:** Apply each filter and sort option.
- **Expected:** Results match selected filters/sort; clearing filters restores eligible products.

### BOOK-004 — Product detail and photo gallery work
- **Priority / layer:** P1 / Component + E2E
- **Preconditions:** Product has multiple photos and metadata.
- **Steps:** Open product; select gallery images.
- **Expected:** Correct details appear; primary image/gallery work; missing optional metadata does not break layout.

### BOOK-005 — Guest can add product to cart
- **Priority / layer:** P0 / E2E
- **Preconditions:** Visitor viewing in-stock product.
- **Steps:** Add product to cart.
- **Expected:** Cart count and contents update with correct product and quantity.

### BOOK-006 — Cart quantity and removal work
- **Priority / layer:** P1 / Component
- **Preconditions:** Cart contains a product.
- **Steps:** Increase/decrease quantity; remove item.
- **Expected:** Quantity and totals update; invalid quantities are handled; removed product disappears.

### BOOK-007 — Cart survives login prompt
- **Priority / layer:** P0 / E2E
- **Preconditions:** Visitor has cart items.
- **Steps:** Start checkout; complete simulated login.
- **Expected:** Cart contents and quantities remain; checkout resumes with same items.

### BOOK-008 — Checkout requires login
- **Priority / layer:** P0 / E2E
- **Preconditions:** Visitor has cart items.
- **Steps:** Attempt checkout without signing in.
- **Expected:** Login prompt appears; cart is preserved; no order is placed before login.

### BOOK-009 — Address form validation
- **Priority / layer:** P1 / Component
- **Preconditions:** Learner on address form.
- **Steps:** Submit missing required fields and invalid mobile/PIN values.
- **Expected:** Required/format validation appears; valid values remain populated.

### BOOK-010 — Multi-book order summary is correct
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Cart contains multiple products and quantities.
- **Steps:** Continue to checkout; inspect order summary.
- **Expected:** Line items, quantities, subtotal, shipping and total are correct.

### BOOK-011 — Insufficient stock blocks checkout
- **Priority / layer:** P0 / Component + E2E
- **Preconditions:** Requested quantity exceeds fixture available stock.
- **Steps:** Open cart/checkout.
- **Expected:** Item remains in cart; checkout is blocked until quantity is adjusted/removed; no backorder is implied.

### BOOK-012 — Manual payment instructions display
- **Priority / layer:** P0 / E2E
- **Preconditions:** Mock order placed.
- **Steps:** Open payment instructions.
- **Expected:** Mock UPI/bank instructions and amount appear; workflow is clearly simulated.

### BOOK-013 — Payment submission shows verification state
- **Priority / layer:** P0 / E2E
- **Preconditions:** Order awaits payment details.
- **Steps:** Enter transaction reference and amount; optionally attach mock evidence; submit.
- **Expected:** Status is pending verification, not payment confirmed.

### BOOK-014 — Customer sees order timeline
- **Priority / layer:** P1 / Component + E2E
- **Preconditions:** Order has multiple lifecycle events.
- **Steps:** Open My Orders and order detail.
- **Expected:** Events are correctly ordered; current status and timestamps are clear.

### BOOK-015 — Customer submits cancellation request
- **Priority / layer:** P1 / E2E
- **Preconditions:** Order is before shipment.
- **Steps:** Request cancellation and submit reason.
- **Expected:** Cancellation request is shown; order is not silently marked refunded.

### BOOK-016 — Customer submits return request
- **Priority / layer:** P1 / E2E
- **Preconditions:** Order delivered within mock seven-day return window.
- **Steps:** Select eligible damaged/defective/incorrect reason; add optional mock evidence; submit.
- **Expected:** Return request appears awaiting admin review.

## 9.9 Bookstore administration

### BOOKADM-001 — Bookstore admin dashboard renders
- **Priority / layer:** P1 / E2E
- **Preconditions:** Admin has bookstore permissions.
- **Steps:** Open bookstore dashboard.
- **Expected:** Orders, payment verification, low-stock and out-of-stock metrics match fixtures.

### BOOKADM-002 — Create/edit book metadata
- **Priority / layer:** P1 / E2E
- **Preconditions:** Admin has product-management permission.
- **Steps:** Edit title, author, publisher, ISBN, categories, subject, language, edition, description, MRP and selling price.
- **Expected:** Product list/detail reflect mock state; missing optional fields do not break layout.

### BOOKADM-003 — Product photo gallery management
- **Priority / layer:** P1 / Component
- **Preconditions:** Product editor open.
- **Steps:** Add images; set primary; reorder; remove.
- **Expected:** Exactly one primary image; gallery order and removal are reflected.

### BOOKADM-004 — Product lifecycle states
- **Priority / layer:** P1 / E2E
- **Preconditions:** Admin can manage products.
- **Steps:** Save Draft; publish; set stock to zero; archive.
- **Expected:** Draft hidden; published zero-stock product remains visible as Out of Stock; archived product leaves storefront.

### BOOKADM-005 — Stock adjustment requires reason
- **Priority / layer:** P1 / Component
- **Preconditions:** Admin has inventory-adjust permission.
- **Steps:** Submit adjustment without reason; then with valid reason.
- **Expected:** Missing reason rejected; valid adjustment updates mock stock and history.

### BOOKADM-006 — Payment approval and rejection
- **Priority / layer:** P0 / E2E
- **Preconditions:** Order has mock payment submission.
- **Steps:** Inspect reference/amount; approve; reject another order with reason.
- **Expected:** Approved order moves to Processing; rejected order shows reason and resubmission state.

### BOOKADM-007 — Dispatch and tracking update
- **Priority / layer:** P1 / E2E
- **Preconditions:** Order approved and processing.
- **Steps:** Enter courier/tracking; mark shipped; update delivery.
- **Expected:** Order timeline and customer tracking view reflect transitions.

### BOOKADM-008 — Return and refund workflow
- **Priority / layer:** P1 / E2E
- **Preconditions:** Return request awaits review.
- **Steps:** Approve/reject; for approval choose replacement/refund; enter mock refund reference.
- **Expected:** Correct state and details appear; no real refund is implied.

### BOOKADM-009 — Staff bookstore permissions
- **Priority / layer:** P0 / E2E
- **Preconditions:** Staff fixtures have different bookstore permissions.
- **Steps:** Inspect product, inventory, payment, fulfilment and settings screens.
- **Expected:** Visible actions match permission fixture; Owner-only settings remain unavailable to Staff.

## 9.10 Responsive behavior

### RESP-001 — Desktop public layout
- **Priority / layer:** P0 / Playwright responsive
- **Preconditions:** Desktop viewport, e.g. 1440 × 900.
- **Steps:** Inspect homepage, course catalog and detail.
- **Expected:** Clear hierarchy/navigation; no clipping, overlap or unintended horizontal overflow.

### RESP-002 — Tablet learner layout
- **Priority / layer:** P1 / Playwright responsive
- **Preconditions:** Tablet viewport, e.g. 768 × 1024.
- **Steps:** Inspect learner dashboard, course detail and player.
- **Expected:** Layout adapts and important controls remain visible/usable.

### RESP-003 — Mobile navigation
- **Priority / layer:** P0 / Playwright responsive
- **Preconditions:** Mobile viewport, e.g. 390 × 844.
- **Steps:** Open menu; navigate Courses, Tests and Bookstore; close menu.
- **Expected:** Menu opens/closes; navigation is touch/keyboard accessible; no page-wide horizontal overflow.

### RESP-004 — Mobile course detail
- **Priority / layer:** P1 / Playwright responsive
- **Preconditions:** Mobile viewport; published course fixture.
- **Steps:** Open detail; expand module/lesson navigation.
- **Expected:** Text readable; actions tappable; no clipped content.

### RESP-005 — Mobile examination
- **Priority / layer:** P0 / Playwright responsive
- **Preconditions:** Mobile viewport; active mock exam.
- **Steps:** Navigate questions; open palette; answer; switch section; submit.
- **Expected:** Critical exam controls are usable; palette does not permanently obscure answer area.

### RESP-006 — Mobile admin
- **Priority / layer:** P1 / Playwright responsive
- **Preconditions:** Mobile viewport; Owner fixture.
- **Steps:** Open admin navigation; inspect course list and management form.
- **Expected:** Navigation/forms remain usable; wide tables have intentional responsive treatment.

### RESP-007 — No page-level horizontal overflow on core routes
- **Priority / layer:** P0 / Playwright responsive
- **Preconditions:** Desktop, tablet and mobile projects configured.
- **Steps:** Visit homepage, course detail, player, exam, admin list, cart and checkout at each viewport.
- **Expected:** No unintentional page-level horizontal scroll; intentional scroll regions remain contained.

## 9.11 Accessibility

Automated scans are a baseline, not a replacement for keyboard and screen-reader testing.

### A11Y-001 — Form controls have accessible names
- **Priority / layer:** P0 / axe-core + Component
- **Preconditions:** Login, signup, checkout and admin forms rendered.
- **Steps:** Run accessibility scan; inspect input labels/names.
- **Expected:** Every input has meaningful accessible name; validation errors are associated with fields.

### A11Y-002 — Keyboard reaches primary controls
- **Priority / layer:** P0 / Playwright
- **Preconditions:** Public, learner and admin screens rendered.
- **Steps:** Use Tab, Shift+Tab, Enter, Space and Escape as appropriate.
- **Expected:** Primary actions are reachable; focus order logical; no keyboard trap.

### A11Y-003 — Focus indicator is visible
- **Priority / layer:** P0 / Playwright + manual
- **Preconditions:** Keyboard navigation active.
- **Steps:** Tab through navigation, forms, dialogs, palette and buttons.
- **Expected:** Focus is visible and not hidden behind overlays.

### A11Y-004 — Dialog focus is managed
- **Priority / layer:** P0 / Component + Playwright
- **Preconditions:** Submission confirmation or other dialog available.
- **Steps:** Open; navigate by keyboard; close; reopen.
- **Expected:** Focus enters dialog, remains managed, and returns to invoking control when closed.

### A11Y-005 — Exam status is not conveyed by color alone
- **Priority / layer:** P0 / Component + axe-core
- **Preconditions:** Palette contains all statuses.
- **Steps:** Inspect accessible labels/status for each palette item.
- **Expected:** Each state has text or accessible status in addition to color/shape.

### A11Y-006 — Heading and landmark structure
- **Priority / layer:** P1 / axe-core
- **Preconditions:** Homepage, course, exam and admin pages rendered.
- **Steps:** Scan accessibility tree and headings/landmarks.
- **Expected:** Coherent page structure, meaningful headings and identifiable main/navigation landmarks.

### A11Y-007 — Text and control contrast
- **Priority / layer:** P0 / axe-core + manual
- **Preconditions:** Core theme loaded.
- **Steps:** Scan homepage, exam, forms, status badges and disabled controls.
- **Expected:** No critical contrast violation in core content; status remains understandable.

### A11Y-008 — Reduced-motion preference
- **Priority / layer:** P2 / Playwright
- **Preconditions:** Application uses animations/transitions.
- **Steps:** Emulate reduced-motion; navigate major pages and dialogs.
- **Expected:** Non-essential motion is reduced without removing necessary feedback.

## 9.12 Loading, empty, error and resilience states

### STATE-001 — Loading state appears for delayed data
- **Priority / layer:** P1 / Component + E2E
- **Preconditions:** Mock data layer can delay response.
- **Steps:** Open catalog with delayed response.
- **Expected:** Loader/skeleton appears; UI does not flash a misleading empty state.

### STATE-002 — Empty course catalog
- **Priority / layer:** P1 / Component
- **Preconditions:** Public course fixture is empty.
- **Steps:** Open Courses.
- **Expected:** Helpful empty state and relevant navigation appear; no blank page.

### STATE-003 — Empty attempt history
- **Priority / layer:** P1 / Component
- **Preconditions:** Learner has no attempts.
- **Steps:** Open attempt history.
- **Expected:** Clear empty state and useful next action appear.

### STATE-004 — Simulated data error is recoverable
- **Priority / layer:** P1 / Component + E2E
- **Preconditions:** Mock data provider can return error.
- **Steps:** Open affected route; activate Retry.
- **Expected:** Useful error shown; retry restores view; no sensitive technical details exposed.

### STATE-005 — Invalid submission preserves valid input
- **Priority / layer:** P1 / Component
- **Preconditions:** Multi-field form with validation.
- **Steps:** Enter valid fields and one invalid field; submit.
- **Expected:** Invalid field identified; valid values are not unnecessarily erased.

### STATE-006 — Missing mock entity shows unavailable state
- **Priority / layer:** P1 / E2E
- **Preconditions:** Route references missing mock record.
- **Steps:** Open direct route.
- **Expected:** Useful not-found/unavailable state appears; app remains navigable.

---

# 10. Test environment and data management

## 10.1 Environment

Use dedicated local test mode with deterministic mock data. Disable real external integrations; use separate test-only configuration; do not place production secrets in test variables.

## 10.2 Mock service boundaries

The frontend should call stable service interfaces rather than importing fixture arrays throughout components. Suggested boundaries:

- `authService`
- `courseService`
- `subscriptionService`
- `progressService`
- `examService`
- `adminCourseService`
- `adminTestService`
- `bookstoreService`
- `notificationService`

In the prototype these use in-memory or local fixture implementations. Later they can be replaced by API clients without rewriting every screen. Mock at service boundaries where practical rather than mocking every internal React hook.

## 10.3 Time-dependent cases

Use fake timers for unit/component tests and fixed ISO timestamps in fixtures. Display test dates in `Asia/Kolkata` for the initial India-focused product. Do not rely on the machine's actual clock or test execution time.

## 10.4 Independence

Each test establishes its own initial state, cleans up mocks/timers, and avoids order dependency. Clone mutable fixtures before changes. E2E tests use isolated browser contexts and deterministic setup.

---

# 11. Suggested project test structure

Adapt to the actual repository after the frontend audit; do not move files solely to match this proposal.

```text
studyverse-frontend/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   └── test/
│       ├── fixtures/
│       │   ├── users.ts
│       │   ├── courses.ts
│       │   ├── subscriptions.ts
│       │   ├── examinations.ts
│       │   └── bookstore.ts
│       ├── mocks/
│       ├── test-utils.tsx
│       └── setup.ts
├── e2e/
│   ├── public/
│   ├── authentication/
│   ├── learner/
│   ├── examinations/
│   ├── admin/
│   ├── bookstore/
│   ├── responsive/
│   └── accessibility/
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

Unit/component tests may live beside the feature they test if that matches the current project convention. Consistent naming and discovery matter more than the exact directory tree.

## 12. Naming and writing rules

- Unit/component files: `*.test.ts` or `*.test.tsx`.
- E2E files: `*.spec.ts`.
- Include test IDs in test names, for example `EXAM-014 — preserves answer when marking for review`.
- Prefer semantic locators: `getByRole`, `getByLabel`, and `getByText`.
- Use `data-testid` only when a stable semantic locator is unsuitable.
- Assert observable behavior rather than internal React state.
- Avoid selectors tied to CSS classes, generated IDs or DOM nesting.
- Avoid arbitrary sleeps; wait for meaningful UI state.
- Keep one clear primary objective per test.
- Use screenshots selectively for high-value visual baselines, not every component.
- Update screenshot baselines only after reviewing intentional visual changes.

---

# 13. Execution order and milestones

## Milestone 0 — Frontend audit

1. Inspect actual Next.js and React versions and package manager.
2. Inventory routes and layouts.
3. Inventory major components and feature modules.
4. Identify state-management and mock-data locations.
5. Identify mock user switching/auth flows.
6. Identify exam state, timer and palette implementation.
7. Identify existing tests and CI scripts.
8. Map screens to this catalogue.
9. Mark each case `Ready`, `Blocked`, `Not implemented` or `Not applicable`.

**Deliverable:** Route inventory and requirements-to-test traceability matrix.

## Milestone 1 — Test infrastructure

1. Configure Vitest.
2. Configure React Testing Library and DOM matchers.
3. Add shared setup and cleanup.
4. Create deterministic fixtures.
5. Configure Playwright.
6. Add one passing unit, component and E2E example.
7. Add test scripts.
8. Confirm tests run locally from a clean checkout.

**Deliverable:** Repeatable test harness.

## Milestone 2 — P0 unit and component coverage

Prioritize exam palette/state mapping, answer preservation, timers, subscription-state selectors, course progress, form validation, cart totals and permission-aware action visibility.

**Deliverable:** Fast tests for the riskiest frontend logic.

## Milestone 3 — P0 E2E journeys

Automate visitor course discovery/free preview, anonymous demo test, non-subscribed lesson lock, mock subscription approval, active learner exam completion, Staff/Owner permission boundary, and guest bookstore cart-to-login-to-checkout.

**Deliverable:** Critical-path browser suite.

## Milestone 4 — P1 functional coverage

Add secondary course, subscription, admin, player and bookstore behaviors, including order timeline, returns, result history and empty/error states.

**Deliverable:** Broad functional regression suite.

## Milestone 5 — Responsive and accessibility

Add viewport tests, axe scans, keyboard interaction checks and manual device checks.

**Deliverable:** Responsive/accessibility evidence for core journeys.

## Milestone 6 — CI and review gate

**Every pull request:** formatting/lint, TypeScript check, unit/component tests, production build and critical Playwright Chromium E2E tests.

**Scheduled/pre-release:** Firefox and WebKit, broader responsive suite, accessibility suite and visual baseline review.

**Deliverable:** Automated quality gate with readable failure reports.

---

# 14. Release acceptance criteria

The frontend prototype is ready for product review when:

- [ ] Every implemented route is represented in the route inventory.
- [ ] Every applicable P0 case passes.
- [ ] Public browsing and free-preview journeys work.
- [ ] Mock authentication and role transitions behave consistently.
- [ ] No-subscription, pending, active and expired UI states are distinct and correct.
- [ ] Course/module/lesson navigation is coherent.
- [ ] Progress and resume work in mock state.
- [ ] All three exam question types work.
- [ ] All five question-palette states are correct and accessible.
- [ ] Section navigation and both timer models follow configured UI behavior.
- [ ] Submission confirmation, result and answer-review states work.
- [ ] Admin course/test interactions work.
- [ ] Owner/Staff permission states are consistent.
- [ ] Guest cart, login continuation and bookstore checkout work.
- [ ] Critical mobile layouts have no accidental horizontal overflow.
- [ ] Critical accessibility findings are resolved.
- [ ] No unhandled console error occurs in critical E2E journeys.
- [ ] Tests run repeatably from a clean checkout.
- [ ] Production Next.js build succeeds.
- [ ] Mock success messages do not claim real external transactions.

P1/P2 cases must have an owner and disposition before review; they must not silently disappear from the backlog.

---

# 15. Defect severity and reporting

| Severity | Definition | Example |
|---|---|---|
| Blocker | Core app unusable or broad state corruption | App crashes on load |
| Critical | Core journey or exam interaction unusable | Learner cannot submit exam |
| Major | Important feature broken with limited workaround | Subscription state displayed incorrectly |
| Minor | Non-critical presentation/convenience issue | Small spacing defect |
| Trivial | Cosmetic polish | Slight icon alignment issue |

Every defect report includes related test ID, environment/browser, viewport/device, fixture/user state, reproduction steps, expected and actual result, evidence where useful, severity and reproducibility.

A defect is fixed only after the failing test is re-run and relevant regression cases pass.

---

# 16. Traceability matrix

| Product requirement | Test IDs |
|---|---|
| Public navigation/discovery | PUB-001 to PUB-008 |
| Authentication UI | AUTH-001 to AUTH-009 |
| Subscription/access-state UI | SUB-001 to SUB-012 |
| Courses and lessons | COURSE-001 to COURSE-010 |
| Video player/progress UI | VID-001 to VID-009 |
| Examination experience | EXAM-001 to EXAM-030 |
| Admin course/test management | ADMIN-001 to ADMIN-015 |
| Bookstore customer experience | BOOK-001 to BOOK-016 |
| Bookstore administration | BOOKADM-001 to BOOKADM-009 |
| Responsive behavior | RESP-001 to RESP-007 |
| Accessibility | A11Y-001 to A11Y-008 |
| Loading/empty/error/resilience | STATE-001 to STATE-006 |

**Total catalogue: 139 test cases** (8 + 9 + 12 + 10 + 9 + 30 + 15 + 16 + 9 + 7 + 8 + 6; earlier drafts said 130 in error).

---

# 17. Future backend test boundary

When the NestJS/PostgreSQL backend is implemented, create a separate backend/API test plan. Frontend mock tests must not be used to claim server correctness.

Backend/API tests must later cover:
- Authentication/session security and account recovery.
- Role and permission enforcement at API level.
- Subscription activation, expiry and renewal transactions.
- Entitlement checks for lesson/test access.
- Video upload resumability and multipart completion idempotency.
- FFmpeg worker leases, retries, checksums and version activation.
- Playback token scope, expiry and private segment delivery.
- Test deadlines, scoring, answer persistence and immutable history.
- Concurrent inventory reservations and oversell prevention.
- Payment verification and order transitions.
- Backup restoration, audit integrity and rate limiting.

A small number of frontend E2E tests can later run against a dedicated test API environment. The majority of UI tests should continue to use controlled fixtures.

---

# 18. Final recommendation

Start with **Milestone 0: audit the actual Next.js implementation**. Do not install packages or write a large suite against an assumed folder structure.

After the audit, confirm tool compatibility, establish deterministic fixtures, implement the test harness, cover the P0 exam/access/navigation behaviors, add full E2E journeys, and finish with responsive/accessibility checks and CI integration.

The goal is not to maximize test count. It is to create a reliable regression suite that catches defects in the StudyVerse learning and examination experience before learners encounter them.
