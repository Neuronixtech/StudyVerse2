import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, FlaskConical, Info, RotateCcw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" | "li" }) {
  return <As className={cn("rounded-2xl border border-line bg-white shadow-card", className)}>{children}</As>;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200/70", className)} aria-hidden />;
}

export function SkeletonCards({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line bg-white p-3">
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
          <div className="space-y-3 p-2 pt-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-white px-6 py-12 text-center", className)}>
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 [&_svg]:size-7">{icon}</div>}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50/60 px-6 py-12 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-red-100 text-red-600">
        <TriangleAlert className="size-7" />
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-600">
        {description ?? "We couldn't load this content. This is a simulated error from the prototype toolbar."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          <RotateCcw className="size-4" /> Try again
        </button>
      )}
    </div>
  );
}

const calloutTones = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-900", icon: <Info /> },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: <CircleCheck /> },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: <TriangleAlert /> },
  danger: { box: "border-red-200 bg-red-50 text-red-900", icon: <CircleAlert /> },
  brand: { box: "border-brand-200 bg-brand-50 text-brand-900", icon: <Info /> },
};

export function Callout({
  tone = "info",
  title,
  children,
  action,
  className,
  icon,
}: {
  tone?: keyof typeof calloutTones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  const t = calloutTones[tone];
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start", t.box, className)}>
      <span className="shrink-0 [&_svg]:size-5">{icon ?? t.icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn("leading-relaxed opacity-90", title ? "mt-0.5" : null)}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Inline marker for anything that would otherwise look like a real backend action */
export function SimulatedNote({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 text-xs text-amber-800", className)}>
      <FlaskConical className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children ?? "Prototype: this action is simulated and only stored in your browser."}</span>
    </p>
  );
}

export function ProgressBar({
  value,
  className,
  tone = "brand",
  label,
  size = "md",
}: {
  value: number;
  className?: string;
  tone?: "brand" | "amber" | "red" | "white";
  label?: string;
  size?: "sm" | "md";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("w-full overflow-hidden rounded-full", size === "sm" ? "h-1.5" : "h-2", tone === "white" ? "bg-white/25" : "bg-slate-100", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "brand" && "bg-brand-500",
          tone === "amber" && "bg-amber-500",
          tone === "red" && "bg-red-500",
          tone === "white" && "bg-white",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "brand",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: "brand" | "amber" | "violet" | "sky" | "rose" | "emerald";
  className?: string;
}) {
  const toneClass = {
    brand: "bg-brand-50 text-brand-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
  }[tone];
  return (
    <div className={cn("rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <span className={cn("grid size-9 place-items-center rounded-xl [&_svg]:size-[18px]", toneClass)}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const palette = ["bg-brand-100 text-brand-800", "bg-violet-100 text-violet-800", "bg-amber-100 text-amber-800", "bg-sky-100 text-sky-800", "bg-rose-100 text-rose-800", "bg-emerald-100 text-emerald-800"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-bold",
        palette[hash % palette.length],
        size === "sm" && "size-7 text-[11px]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-12 text-sm",
        size === "xl" && "size-16 text-lg",
        className,
      )}
    >
      {letters}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Generic page-level loading skeleton used as a Suspense fallback */
export function PageSkeleton({ variant = "page" }: { variant?: "page" | "full" | "admin" }) {
  if (variant === "full") {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-100" role="status" aria-label="Loading">
        <div className="size-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }
  return (
    <div className={cn(variant === "page" && "container-page py-10", "space-y-4")} role="status" aria-label="Loading">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
