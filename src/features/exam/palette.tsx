import { Check } from "lucide-react";
import { STATE_LABEL } from "@/lib/exam";
import type { QuestionState } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLE: Record<QuestionState, string> = {
  "not-visited": "bg-slate-200 text-slate-700 ring-1 ring-inset ring-slate-300 rounded-md",
  "not-answered": "bg-q-notanswered text-white rounded-t-xl rounded-b-sm",
  answered: "bg-q-answered text-white rounded-b-xl rounded-t-sm",
  review: "bg-q-review text-white rounded-full",
  "answered-review": "bg-q-review text-white rounded-full",
};

/** NTA palette cell — colour and shape both encode the status */
export function PaletteCell({
  state,
  label,
  size = "md",
  current,
  className,
}: {
  state: QuestionState;
  label: string | number;
  size?: "sm" | "md";
  current?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center font-bold tabular-nums",
        size === "sm" ? "size-7 text-[11px]" : "size-10 text-sm",
        STYLE[state],
        current && "outline-2 outline-offset-2 outline-fg",
        className,
      )}
    >
      {label}
      {state === "answered-review" && (
        <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-q-answered ring-2 ring-surface">
          <Check className="size-2.5 text-white" strokeWidth={4} />
        </span>
      )}
    </span>
  );
}

export const LEGEND_ORDER: QuestionState[] = ["not-visited", "not-answered", "answered", "review", "answered-review"];

export function PaletteLegend({ counts, compact }: { counts?: Record<QuestionState, number>; compact?: boolean }) {
  return (
    <ul className={cn("grid gap-2.5", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
      {LEGEND_ORDER.map((s) => (
        <li key={s} className={cn("flex items-center gap-2.5 text-xs text-slate-600", s === "answered-review" && "col-span-2")}>
          <PaletteCell state={s} label={counts ? counts[s] : ""} size="sm" />
          <span className="font-medium">{STATE_LABEL[s]}</span>
        </li>
      ))}
    </ul>
  );
}
