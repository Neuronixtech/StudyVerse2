import { act, render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { Toaster } from "@/components/ui/toast";
import type { AppState } from "@/lib/mock/seed";
import { getState, setState } from "@/lib/store";
import { createTestState, type TestStateOptions } from "./fixtures/state";

/** Replaces the prototype store's state (the app's service boundary) with `state`. */
export function seedStore(state: AppState): AppState {
  act(() => setState(() => state));
  return state;
}

/** The store's current state, for asserting on mock mutations. */
export const storeState = () => getState();

/** A userEvent instance that cooperates with fake timers when they're enabled. */
export function setupUser() {
  return vi.isFakeTimers() ? userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) : userEvent.setup();
}

interface RenderWithStoreOptions extends Omit<RenderOptions, "wrapper"> {
  /** Exact state to seed. Takes precedence over `session`. */
  state?: AppState;
  /** Shortcut: seed the default fixture state with this learner/admin signed in. */
  session?: TestStateOptions;
}

/**
 * Renders `ui` against the real prototype store, seeded with deterministic
 * fixture data, plus the toast outlet so simulated-action messages can be asserted.
 */
export function renderWithStore(ui: ReactElement, { state, session, ...options }: RenderWithStoreOptions = {}) {
  seedStore(state ?? createTestState(session));
  const user = setupUser();
  const utils = render(
    <>
      {ui}
      <Toaster />
    </>,
    options,
  );
  return { user, ...utils };
}

/** Advances fake timers inside act() so React flushes the resulting updates. */
export async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
