# StudyVerse — UI prototype

A clickable UI prototype of StudyVerse, the subscription learning platform for JEE Main, JEE Advanced and MHT-CET aspirants described in [PLAN.md](PLAN.md). It's built with Next.js 16 (App Router, Cache Components) and Tailwind CSS v4.

> **Everything is mock data.** There is no database, no auth provider, no payments and no video streaming. Sign-in, payment requests, approvals and uploads are simulated, and state is saved only in your browser's `localStorage`.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (validates every route)
npm run lint
```

## Exploring the prototype

Use the **Prototype** button in the bottom-left corner to:

- switch learner personas: Visitor, Aarav (no subscription), Diya (pending request), Rohan (active), Sneha (expired)
- sign in to the admin console as the **Owner** (Vikram) or a **Staff admin** (Priya, who has limited permissions)
- simulate slow-network skeletons and request errors on list views
- reset all mock data

Login pages also have one-click demo accounts. Any email that belongs to a mock learner signs in with any password of 6+ characters.

**Tip:** open the admin console in one tab and a learner view in another. Approving a request in the admin tab updates the learner tab live.

## Main routes

| Area | Routes |
| --- | --- |
| Public | `/`, `/courses`, `/courses/[slug]`, `/tests`, `/tests/[testId]`, `/subscribe` |
| Auth | `/login`, `/signup`, `/forgot-password`, `/reset-password` |
| Learning | `/learn/[slug]/[lessonId]` (simulated player with resume and progress tracking) |
| Exam (NTA-style) | `/exam/[testId]` (instructions), `/exam/[testId]/live`, `/results/[attemptId]`, `/results/[attemptId]/review` |
| Learner | `/dashboard`, `/dashboard/courses`, `/dashboard/attempts`, `/dashboard/subscription`, `/dashboard/profile` |
| Admin | `/admin/login`, `/admin`, `/admin/courses`, `/admin/tests`, `/admin/learners`, `/admin/requests`, `/admin/subscriptions`, `/admin/staff` (owner only), `/admin/settings` |

## Code map

- `src/app`: routes, grouped into `(site)`, `(auth)`, `(player)`, `(exam)` and `admin/(console)` layouts
- `src/features`: one folder of client views per area (home, courses, player, exam, results, dashboard, admin…)
- `src/components`: the design system (`ui/`), site chrome (`layout/`) and shared cards and visuals
- `src/lib/mock`: seed data (courses, a 36-question bank, tests, learners, requests, attempts)
- `src/lib/store.ts`: the prototype store (`useSyncExternalStore`, localStorage, cross-tab sync) and every simulated action
- `src/lib/exam.ts`: scoring (single, multi with partial marking, numerical with tolerance), palette states and attempt snapshots
- `src/lib/access.ts`: subscription status (renewals extend expiry), lesson and test access rules, admin permissions

Design tokens (the teal palette inspired by `design/webiste-design.jpg`) live in `src/app/globals.css`.
