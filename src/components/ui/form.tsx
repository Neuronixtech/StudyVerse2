"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "block w-full rounded-lg border bg-surface text-sm text-fg placeholder:text-slate-400 shadow-xs transition-[border-color,box-shadow] outline-none focus:border-brand-500 focus:shadow-ring disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export function Label({ className, children, ...rest }: ComponentProps<"label">) {
  return (
    <label className={cn("block text-sm font-semibold text-fg", className)} {...rest}>
      {children}
    </label>
  );
}

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Label + control + hint/error wiring with correct aria attributes */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
        </Label>
      )}
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return (
    <input
      className={cn(control, "h-10 px-3 aria-invalid:border-red-400 aria-invalid:focus:shadow-[0_0_0_4px_rgb(239_68_68/0.15)]", "border-line-strong", className)}
      {...rest}
    />
  );
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(control, "min-h-24 border-line-strong px-3 py-2.5 leading-relaxed aria-invalid:border-red-400", className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(control, "h-10 appearance-none border-line-strong pr-9 pl-3 aria-invalid:border-red-400", className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", rest.disabled && "cursor-not-allowed opacity-60", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-brand-600"
        {...rest}
      />
      <span className="text-sm">
        <span className="font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-semibold text-fg">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-brand-600" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5.5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

/** Pill-style multi select (chips) */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  error,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T[];
  onChange: (v: T[]) => void;
  label?: string;
  error?: string | null;
}) {
  return (
    <fieldset className="space-y-1.5">
      {label && <legend className="mb-1.5 text-sm font-semibold text-fg">{label}</legend>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              aria-pressed={active}
              onClick={() => onChange(active ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-line-strong bg-surface text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </fieldset>
  );
}

/** Segmented radio control */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    // flex-wrap: segments move to a second row only when they don't fit (narrow phones), never sideways off-screen
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full flex-wrap rounded-lg bg-slate-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
            value === o.value ? "bg-surface text-fg shadow-sm" : "text-slate-500 hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
