import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "brand" | "green" | "amber" | "red" | "violet" | "sky" | "slate" | "dark";

const tones: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
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
        light ? "border-white/30 bg-white/10 text-white" : "border-brand-200 bg-brand-50 text-brand-700",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", light ? "bg-white" : "bg-brand-500")} aria-hidden />
      {children}
    </span>
  );
}
