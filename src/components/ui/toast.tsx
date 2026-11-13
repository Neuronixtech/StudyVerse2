"use client";

import { useSyncExternalStore } from "react";
import { CircleCheck, CircleX, FlaskConical, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  /** Shows a "Simulated" chip so mock actions are never mistaken for real backend actions */
  simulated?: boolean;
}

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(input: Omit<ToastItem, "id" | "tone"> & { tone?: ToastTone }) {
  const id = ++seq;
  const item: ToastItem = { tone: "success", ...input, id };
  items = [...items, item].slice(-4);
  emit();
  setTimeout(() => dismiss(id), 4500);
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

const EMPTY: ToastItem[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
    () => EMPTY,
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border border-line bg-white p-3.5 shadow-lift"
        >
          <span
            className={cn(
              "mt-0.5 shrink-0 [&_svg]:size-5",
              t.tone === "success" && "text-emerald-600",
              t.tone === "error" && "text-red-600",
              t.tone === "info" && "text-brand-600",
            )}
          >
            {t.tone === "success" ? <CircleCheck /> : t.tone === "error" ? <CircleX /> : <Info />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t.description}</p>}
            {t.simulated && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase ring-1 ring-amber-200">
                <FlaskConical className="size-3" /> Simulated · prototype only
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="-m-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-ink"
            aria-label="Dismiss notification"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
