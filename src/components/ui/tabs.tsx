"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

/** Underlined tab bar with roving keyboard focus (←/→) */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
  variant = "underline",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  variant?: "underline" | "pill";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    for (let step = 1; step <= items.length; step++) {
      const next = (index + dir * step + items.length) % items.length;
      if (!items[next].disabled) {
        refs.current[next]?.focus();
        onChange(items[next].value);
        break;
      }
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "scrollbar-thin flex overflow-x-auto",
        variant === "underline" ? "gap-1 border-b border-line" : "gap-1.5 rounded-xl bg-slate-100 p-1",
        className,
      )}
    >
      {items.map((item, i) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-40",
              variant === "underline"
                ? cn("-mb-px border-b-2 px-3 py-2.5", active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-ink")
                : cn("rounded-lg px-3 py-1.5", active ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"),
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[11px] font-bold",
                  active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
