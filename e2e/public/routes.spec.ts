import { expect, test } from "../support/fixtures";

/**
 * Route resolution against the production server (`next build && next start`).
 * Every route in src/app is requested with real seed parameters. Dynamic pages read
 * the browser's mock store, so an unknown id renders an in-page "not found" state
 * (HTTP 200); unknown paths return a real 404.
 */
const ROUTES: [url: string, heading: RegExp][] = [
  ["/", /./],
  ["/courses", /Courses|courses/],
  ["/courses/jee-physics-mechanics", /JEE Physics: Mechanics Masterclass/],
  ["/tests", /./],
  ["/tests/t-demo", /Free Demo Test/],
  ["/subscribe", /One plan/],
  ["/login", /Log in/],
  ["/signup", /Create your account/],
  ["/forgot-password", /Forgot password/],
  ["/reset-password", /Set a new password/],
  ["/learn/jee-physics-mechanics/c-mechanics-m1-l1", /Welcome: how to use this course/],
  ["/exam/t-demo", /General instructions/],
  ["/exam/t-demo/live", /No attempt in progress/],
  ["/results/at-001", /Free Demo Test/],
  ["/results/at-001/review", /Answer review/],
  ["/books", /./],
  ["/books/catalog", /All books/],
  ["/books/calculus-workbook", /Calculus Workbook/],
  ["/books/cart", /Your cart/],
  ["/books/checkout", /Checkout/],
  ["/books/orders/o-10241/payment", /Complete your payment/],
  ["/dashboard", /Rohan/],
  ["/dashboard/courses", /./],
  ["/dashboard/attempts", /Attempt history/],
  ["/dashboard/subscription", /Subscription/],
  ["/dashboard/profile", /./],
  ["/dashboard/orders", /./],
  ["/dashboard/orders/o-10241", /SVB-10241/],
  ["/dashboard/addresses", /./],
  ["/admin/login", /Admin console/],
  ["/admin", /./],
  ["/admin/courses", /Courses/],
  ["/admin/courses/new", /New course/],
  ["/admin/courses/c-mechanics", /JEE Physics: Mechanics Masterclass/],
  ["/admin/tests", /Tests/],
  ["/admin/tests/new", /./],
  ["/admin/tests/t-demo", /Free Demo Test/],
  ["/admin/learners", /Learners/],
  ["/admin/learners/l-rohan", /Rohan Iyer/],
  ["/admin/requests", /Activation requests/],
  ["/admin/subscriptions", /Subscriptions/],
  ["/admin/staff", /Admins & staff/],
  ["/admin/settings", /Settings/],
  ["/admin/profile", /./],
  ["/admin/bookstore", /./],
  ["/admin/bookstore/books", /./],
  ["/admin/bookstore/books/new", /./],
  ["/admin/bookstore/books/b-calculus-workbook", /Calculus Workbook/],
  ["/admin/bookstore/orders", /./],
  ["/admin/bookstore/orders/o-10238", /SVB-10238/],
  ["/admin/bookstore/dispatch", /Dispatch/],
  ["/admin/bookstore/returns", /./],
  ["/admin/bookstore/reports", /./],
  ["/admin/bookstore/settings", /./],
];

test.describe("Route resolution (production build)", () => {
  test.use({ session: { learner: "learnerActive", admin: "owner" } });

  test("STATE-006 / route audit — every route in src/app resolves with HTTP 200 and renders its page", async ({ page }) => {
    test.setTimeout(120_000);
    expect(ROUTES).toHaveLength(54);
    for (const [url, heading] of ROUTES) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
      await expect(page.getByRole("heading").filter({ hasText: heading }).first(), url).toBeVisible();
    }
  });

  test.describe(() => {
    test.use({ allowedErrors: [/status of 404/] });

    test("STATE-006 / route audit — unknown paths return 404, unknown ids render a not-found state", async ({ page }) => {
      for (const url of ["/nope", "/admin/bookstore/nope", "/courses/x/y", "/books/orders/o-10241"]) {
        expect((await page.goto(url))?.status(), url).toBe(404);
      }
      // "/books/orders" is the [slug] page with slug "orders" — reserved, so never a real book
      for (const url of ["/books/no-such-book", "/books/orders"]) {
        expect((await page.goto(url))?.status(), url).toBe(200);
        await expect(page.getByText(/not found|isn't available|no longer/i).first(), url).toBeVisible();
      }
      await page.goto("/admin/bookstore/books/b-nope");
      await expect(page.getByText(/not found/i).first()).toBeVisible();
    });
  });
});
