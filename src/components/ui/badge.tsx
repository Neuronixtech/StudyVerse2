import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "brand" | "green" | "amber" | "red" | "violet" | "sky" | "slate" | "dark";

const tones: Record<Tone, string> = {
  brand: "bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300 ring-brand-200 dark:ring-brand-400/30",
  green: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30",
  amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 ring-amber-200 dark:ring-amber-500/30",
  red: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/30",
  violet: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-500/30",
  sky: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-500/30",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  dark: "bg-ink text-white ring-ink",
};

const dots: Record<Tone, string> = {
  brand: "bg-brand-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  slate: "bg-slate-400",
  dark: "bg-white",
};

export function Badge({
  tone = "slate",
  dot,
  size = "sm",
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  size?: "xs" | "sm";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset [&_svg]:size-3.5",
        size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}

/** Section eyebrow pill used above headings, as in the design reference */
export function Eyebrow({ children, className, light }: { children: ReactNode; className?: string; light?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold tracking-wide uppercase",
        light ? "border-white/30 bg-white/10 text-white" : "border-brand-200 dark:border-brand-400/30 bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", light ? "bg-white" : "bg-brand-500")} aria-hidden />
      {children}
    </span>
  );
}
