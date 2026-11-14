import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-mist px-4 text-center">
      <Logo />
      <span className="mt-10 grid size-16 place-items-center rounded-2xl bg-brand-100 dark:bg-brand-400/15 text-brand-700 dark:text-brand-300">
        <Compass className="size-8" />
      </span>
      <p className="mt-6 text-sm font-bold tracking-widest text-brand-600 dark:text-brand-400 uppercase">Error 404</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">This page isn&apos;t on the syllabus</h1>
      <p className="mt-3 max-w-md text-slate-500">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Go home
        </Link>
        <Link href="/courses" className="rounded-lg border border-line-strong bg-surface px-5 py-2.5 text-sm font-semibold text-fg hover:bg-slate-50">
          Browse courses
        </Link>
      </div>
    </div>
  );
}
