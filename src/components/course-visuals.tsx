import { Atom, FlaskConical, Layers, Sigma } from "lucide-react";
import type { SubjectId, ThumbTheme } from "@/lib/types";
import { cn } from "@/lib/utils";

export const THEMES: Record<ThumbTheme, { bg: string; accent: string; label: string }> = {
  teal: { bg: "from-brand-500 via-brand-600 to-brand-800", accent: "bg-brand-300/40", label: "Teal" },
  violet: { bg: "from-violet-500 via-violet-600 to-indigo-700", accent: "bg-violet-300/40", label: "Violet" },
  amber: { bg: "from-amber-400 via-orange-500 to-orange-600", accent: "bg-yellow-200/50", label: "Amber" },
  sky: { bg: "from-sky-400 via-sky-600 to-blue-700", accent: "bg-sky-200/40", label: "Sky" },
  rose: { bg: "from-rose-400 via-rose-500 to-pink-700", accent: "bg-rose-200/40", label: "Rose" },
  emerald: { bg: "from-emerald-400 via-emerald-600 to-teal-700", accent: "bg-emerald-200/40", label: "Emerald" },
};

export function SubjectIcon({ subject, className }: { subject?: SubjectId | "mixed"; className?: string }) {
  if (subject === "physics") return <Atom className={className} aria-hidden />;
  if (subject === "chemistry") return <FlaskConical className={className} aria-hidden />;
  if (subject === "mathematics") return <Sigma className={className} aria-hidden />;
  return <Layers className={className} aria-hidden />;
}

const GLYPHS: Record<SubjectId | "mixed", string[]> = {
  physics: ["F = ma", "v² = u² + 2as", "E = hν", "τ = r × F"],
  chemistry: ["pH = −log[H⁺]", "PV = nRT", "ΔG = ΔH − TΔS", "sp³"],
  mathematics: ["∫ f(x) dx", "lim x→0", "dy/dx", "nCr"],
  mixed: ["F = ma", "PV = nRT", "∫ f(x) dx", "sp²"],
};

/** Illustrated course thumbnail — gradient, subject glyph and formula motif (no stock photos needed) */
export function CourseThumb({
  theme,
  subjectIds,
  title,
  className,
  size = "md",
}: {
  theme: ThumbTheme;
  subjectIds: SubjectId[];
  title?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const subject: SubjectId | "mixed" = subjectIds.length === 1 ? subjectIds[0] : "mixed";
  const t = THEMES[theme];
  const glyphs = GLYPHS[subject];
  return (
    <div
      className={cn("relative isolate overflow-hidden bg-linear-to-br text-white", t.bg, className)}
      role={title ? "img" : undefined}
      aria-label={title ? `${title} thumbnail` : undefined}
      aria-hidden={title ? undefined : true}
    >
      <div className="bg-grid-faint absolute inset-0 -z-10 opacity-60" />
      <div className={cn("absolute -top-10 -right-10 -z-10 size-40 rounded-full blur-2xl", t.accent)} />
      <div className="absolute -bottom-14 -left-8 -z-10 size-36 rounded-full bg-white/10" />
      {size !== "sm" && (
        <div className="absolute inset-0 -z-10 font-mono text-[11px] font-medium text-white/30">
          <span className="absolute top-[14%] left-[8%]">{glyphs[0]}</span>
          <span className="absolute top-[58%] left-[56%]">{glyphs[1]}</span>
          <span className="absolute top-[78%] left-[12%]">{glyphs[2]}</span>
          <span className="absolute top-[22%] left-[62%]">{glyphs[3]}</span>
        </div>
      )}
      <div className="flex h-full items-center justify-center">
        <span
          className={cn(
            "grid place-items-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur-sm",
            size === "sm" ? "size-9 rounded-lg" : size === "lg" ? "size-24" : "size-16",
          )}
        >
          <SubjectIcon subject={subject} className={cn(size === "sm" ? "size-5" : size === "lg" ? "size-12" : "size-8")} />
        </span>
      </div>
    </div>
  );
}
