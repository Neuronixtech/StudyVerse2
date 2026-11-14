import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id="sv-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#189a8c" />
          <stop offset="1" stopColor="#0e675e" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#sv-g)" />
      <path d="M11 15.5 20 11l9 4.5-9 4.5-9-4.5Z" fill="#fff" />
      <path d="M14.5 18.2v5.3c0 1.6 2.5 3.5 5.5 3.5s5.5-1.9 5.5-3.5v-5.3L20 21l-5.5-2.8Z" fill="#fff" fillOpacity=".85" />
      <circle cx="29" cy="25" r="1.6" fill="#a9e6da" />
      <path d="M29 16v9" stroke="#a9e6da" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", light, className, suffix }: { href?: string; light?: boolean; className?: string; suffix?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-lg", className)} aria-label="StudyVerse home">
      <LogoMark />
      <span className={cn("text-lg font-extrabold tracking-tight", light ? "text-white" : "text-fg")}>
        Study<span className={light ? "text-brand-200" : "text-brand-600 dark:text-brand-400"}>Verse</span>
      </span>
      {suffix && (
        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase", light ? "bg-white/15 text-white" : "bg-ink text-white")}>
          {suffix}
        </span>
      )}
    </Link>
  );
}
