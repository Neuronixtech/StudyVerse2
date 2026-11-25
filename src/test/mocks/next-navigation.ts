import { vi } from "vitest";

/**
 * Drop-in replacement for `next/navigation` in component tests. Opt in per file:
 *
 *   vi.mock("next/navigation", () => import("@/test/mocks/next-navigation"));
 *
 * then import `router` / `setNavigation` from this module to drive and assert it.
 */

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

let pathname = "/";
let searchParams = new URLSearchParams();

/** Sets what `usePathname()` and `useSearchParams()` return. Call before rendering. */
export function setNavigation({ path = "/", search = "" }: { path?: string; search?: string } = {}) {
  pathname = path;
  searchParams = new URLSearchParams(search);
}

export const useRouter = () => router;
export const usePathname = () => pathname;
export const useSearchParams = () => searchParams;
export const useParams = () => ({});
export const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
export const redirect = vi.fn();
