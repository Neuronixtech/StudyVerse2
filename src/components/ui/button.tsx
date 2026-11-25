import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "subtle" | "white" | "dark";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
  secondary: "border border-line-strong bg-surface text-fg shadow-xs hover:border-slate-300 hover:bg-slate-50",
  outline: "border border-brand-600 bg-surface text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-400/10",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-fg",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  subtle: "bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-400/15",
  white: "bg-surface text-brand-800 dark:text-brand-200 shadow-sm hover:bg-brand-50 dark:hover:bg-brand-400/10",
  dark: "bg-ink text-white hover:bg-slate-800",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs [&_svg]:size-3.5",
  sm: "h-9 px-3.5 text-sm [&_svg]:size-4",
  md: "h-10 px-4 text-sm [&_svg]:size-4",
  lg: "h-12 px-6 text-base [&_svg]:size-5",
};

const radius: Record<ButtonSize, string> = { xs: "rounded-md", sm: "rounded-lg", md: "rounded-lg", lg: "rounded-xl" };

/**
 * Lets `className` override a variant's colours/radius without depending on CSS order:
 * drops base tokens whose (modifier + utility group) is redefined in the override.
 */
function groupOf(token: string): string | null {
  const i = token.lastIndexOf(":");
  // `dark:` belongs to the same group, so an override replaces both theme variants
  const mod = (i >= 0 ? token.slice(0, i + 1) : "").replace(/^dark:/, "");
  const u = token.slice(i + 1);
  if (/^(hidden|block|inline|inline-block|inline-flex|flex|grid|inline-grid|contents)$/.test(u)) return `${mod}display`;
  if (u.startsWith("bg-")) return `${mod}bg`;
  if (u.startsWith("rounded")) return `${mod}rounded`;
  if (/^text-(xs|sm|base|lg|\d?xl|\[)/.test(u)) return `${mod}text-size`;
  if (u.startsWith("text-")) return `${mod}text-color`;
  if (/^border-(?!\d|x-|y-|t-|b-|l-|r-|dashed|solid)/.test(u)) return `${mod}border-color`;
  if (u.startsWith("shadow")) return `${mod}shadow`;
  return null;
}

export function mergeClasses(base: string, override?: string): string {
  if (!override) return base;
  const taken = new Set(override.split(/\s+/).map(groupOf).filter(Boolean));
  return `${base
    .split(/\s+/)
    .filter((t) => {
      const g = groupOf(t);
      return !g || !taken.has(g);
    })
    .join(" ")} ${override}`;
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

export function buttonClass({ variant = "primary", size = "md", pill, block, className }: Omit<CommonProps, "children">) {
  return mergeClasses(cn(base, variants[variant], sizes[size], pill ? "rounded-full" : radius[size], block && "w-full"), className);
}

export function Button({
  variant,
  size,
  pill,
  block,
  loading,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: CommonProps & ComponentProps<"button"> & { loading?: boolean }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, pill, block, className })}
      {...rest}
    >
      {loading && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  pill,
  block,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass({ variant, size, pill, block, className })} {...rest}>
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  variant = "ghost",
  size = "md",
  ...rest
}: { label: string; variant?: ButtonVariant; size?: "sm" | "md" } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={mergeClasses(
        cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-40",
          size === "sm" ? "size-8 [&_svg]:size-4" : "size-10 [&_svg]:size-5",
          variants[variant],
        ),
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
