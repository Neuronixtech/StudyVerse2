"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Accessible disclosure menu: closes on outside click, Escape, or item selection */
export function Menu({
  trigger,
  children,
  align = "right",
  label,
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu" })}
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            "absolute z-50 mt-2 min-w-56 animate-slide-up rounded-xl border border-line bg-surface p-1.5 shadow-lift",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  icon,
  danger,
}: {
  children: ReactNode;
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors [&_svg]:size-4",
        danger ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10" : "text-slate-700 hover:bg-slate-100 hover:text-fg",
      )}
    >
      {icon && <span className={danger ? "text-red-500" : "text-slate-400"}>{icon}</span>}
      {children}
    </button>
  );
}
