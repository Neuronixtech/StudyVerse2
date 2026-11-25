import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

/* ------------------------------------------------------------------
   Browser APIs jsdom doesn't implement. Kept minimal: they make the
   components render, they don't emulate browser behaviour (focus
   trapping, top-layer, etc. are covered by Playwright).
------------------------------------------------------------------- */

if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;
  if (!proto.showModal) {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!proto.show) {
    proto.show = function show(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!proto.close) {
    proto.close = function close(this: HTMLDialogElement) {
      if (!this.open) return;
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
}

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
}

// React Testing Library's async utilities only advance fake timers when they find a
// global `jest`. Without this shim, userEvent hangs whenever a test calls vi.useFakeTimers().
(globalThis as unknown as { jest: { advanceTimersByTime: (ms: number) => void } }).jest = {
  advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
};

beforeEach(() => {
  // The prototype store persists to localStorage; every test starts from an empty browser.
  if (typeof window !== "undefined") window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  // Restores Date and timers if a test faked them, so time never leaks between tests.
  vi.useRealTimers();
});
