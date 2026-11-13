"use client";

import { useEffect, useMemo, useState } from "react";
import { getSubscription } from "./access";
import { useAppState, useNow } from "./store";

/** Current learner/admin session plus derived subscription info */
export function useSession() {
  const state = useAppState();
  const now = useNow();
  const learner = state.learners.find((l) => l.id === state.session.learnerId);
  const admin = state.admins.find((a) => a.id === state.session.adminId);
  const sub = useMemo(() => getSubscription(state, learner?.id, now), [state, learner?.id, now]);
  return { state, ready: state.ready, learner, admin, sub, now };
}

export type LoadStatus = "loading" | "error" | "success";

/**
 * Simulates network latency / failure for catalog-style views, driven by the
 * prototype toolbar. Without the toggles enabled it resolves immediately.
 */
export function useSimulatedLoad(key: string): { status: LoadStatus; retry: () => void } {
  const { prefs } = useAppState();
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [recovered, setRecovered] = useState<string | null>(null);
  const token = `${key}#${attempt}`;

  useEffect(() => {
    if (!prefs.simulateLatency && !prefs.simulateError) return;
    const t = setTimeout(() => setSettledKey(token), prefs.simulateLatency ? 1100 : 0);
    return () => clearTimeout(t);
  }, [token, prefs.simulateLatency, prefs.simulateError]);

  const retry = () => {
    setRecovered(`${key}#${attempt + 1}`);
    setAttempt((a) => a + 1);
  };

  if (!prefs.simulateLatency && !prefs.simulateError) return { status: "success", retry };
  if (settledKey !== token) return { status: "loading", retry };
  if (prefs.simulateError && recovered !== token) return { status: "error", retry };
  return { status: "success", retry };
}
