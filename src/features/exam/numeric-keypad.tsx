"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

/** On-screen keypad for numerical answers (as in the NTA CBT). The input remains typeable too. */
export function NumericInput({
  id,
  value,
  onChange,
  allowNegative,
  precision,
  error,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  allowNegative: boolean;
  precision: number;
  error?: string | null;
}) {
  const press = (k: string) => {
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === "clear") return onChange("");
    if (k === "-") return onChange(value.startsWith("-") ? value.slice(1) : `-${value}`);
    if (k === "." && value.includes(".")) return;
    if (value.length >= 12) return;
    onChange(value + k);
  };
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "-"];

  return (
    <div className="max-w-xs">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        Your answer
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.-]/g, "");
          onChange(v);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}
        placeholder="Enter a number"
        className={cn(
          "mt-1.5 h-12 w-full rounded-xl border-2 bg-white px-4 font-mono text-lg font-bold text-ink outline-none focus:border-brand-500 focus:shadow-ring",
          error ? "border-red-400" : "border-line-strong",
        )}
      />
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
        {precision > 0 ? `Enter your answer up to ${precision} decimal place${precision > 1 ? "s" : ""}.` : "Enter an integer value."}
        {!allowNegative && " Negative values are not expected."}
      </p>
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Numeric keypad">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            disabled={k === "-" && !allowNegative}
            className="h-11 rounded-lg border border-line-strong bg-white font-mono text-base font-bold text-ink shadow-xs transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-35"
            aria-label={k === "-" ? "Toggle minus sign" : k === "." ? "Decimal point" : k}
          >
            {k === "-" ? "±" : k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => press("back")}
          className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          <Delete className="size-4" /> Backspace
        </button>
        <button type="button" onClick={() => press("clear")} className="h-11 rounded-lg border border-line-strong bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          Clear
        </button>
      </div>
    </div>
  );
}
