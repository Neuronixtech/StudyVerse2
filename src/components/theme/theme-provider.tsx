"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export const THEME_STORAGE_KEY = "studyverse-theme";

/**
 * App-wide theme state.
 * - attribute="class": toggles `.dark` on <html>, which drives both the CSS
 *   token overrides in globals.css and Tailwind's `dark:` variant.
 * - next-themes injects a blocking inline script, so the stored (or system)
 *   theme is applied before first paint: no white flash on reload.
 * - Lives in the root layout, which never remounts on <Link>/router
 *   navigation, so the theme can't revert between pages.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey={THEME_STORAGE_KEY}>
      {children}
    </NextThemesProvider>
  );
}
