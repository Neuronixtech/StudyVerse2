"use client";

import { useRef, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * `false` during SSR and hydration, `true` once mounted in the browser.
 * Equivalent to the classic `useEffect(() => setMounted(true), [])`, but
 * without a setState-in-effect re-render (which this repo's React Compiler
 * lint rules disallow).
 */
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const TRANSITION_MS = 350;

/**
 * Accessible light/dark toggle. The resolved theme is only known in the
 * browser, so the server and the hydration pass render a neutral
 * placeholder of the same size — identical HTML, no layout shift.
 */
export function ThemeToggle({ className, tone = "default" }: { className?: string; tone?: "default" | "onDark" }) {
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();
  const timer = useRef<number | undefined>(undefined);
  const isDark = mounted && resolvedTheme === "dark";
  const label = !mounted ? "Toggle colour theme" : isDark ? "Switch to light theme" : "Switch to dark theme";

  const toggle = () => {
    // Enable colour transitions only for the duration of this switch.
    const root = document.documentElement;
    root.classList.add("theme-transition");
    setTheme(isDark ? "light" : "dark");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => root.classList.remove("theme-transition"), TRANSITION_MS + 50);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!mounted}
      aria-label={label}
      title={mounted ? label : undefined}
      className={cn(
        "relative grid size-10 shrink-0 place-items-center rounded-lg transition-colors disabled:cursor-default",
        tone === "onDark" ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-fg",
        className,
      )}
    >
      {mounted ? (
        <>
          <Sun
            aria-hidden
            className={cn("absolute size-5 transition-all duration-300", isDark ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0")}
          />
          <Moon
            aria-hidden
            className={cn("absolute size-5 transition-all duration-300", isDark ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")}
          />
        </>
      ) : (
        <span aria-hidden className="size-5 rounded-full border-2 border-current opacity-30" />
      )}
    </button>
  );
}
