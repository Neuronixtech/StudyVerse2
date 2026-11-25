import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Breadcrumbs({ items, light }: { items: { href?: string; label: string }[]; light?: boolean }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className={cn("flex flex-wrap items-center gap-1 text-sm", light ? "text-brand-100" : "text-slate-500")}>
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
            {item.href ? (
              <Link href={item.href} className={cn("hover:underline", light ? "hover:text-white" : "hover:text-fg")}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className={cn("font-semibold", light ? "text-white" : "text-fg")}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Mint banner used at the top of catalog-style public pages */
export function PageBanner({
  title,
  description,
  crumbs,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  crumbs: { href?: string; label: string }[];
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-mist">
      <div className="bg-dots absolute inset-0 opacity-60 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
      <div className="absolute -top-24 -right-24 size-72 rounded-full bg-brand-100/80 dark:bg-brand-400/15 blur-2xl" />
      <div className="container-page relative py-10 sm:py-12">
        <Breadcrumbs items={crumbs} />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-base text-slate-500">{description}</p>}
        {children}
      </div>
    </section>
  );
}
