import { BadgeCheck, Quote, Star } from "lucide-react";
import { Logo } from "@/components/brand";
import { PrototypeToolbar } from "@/components/layout/prototype-toolbar";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)] xl:grid-cols-[1fr_640px]">
      <div className="flex flex-col px-4 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <p className="text-center text-xs text-slate-400 lg:text-left">© 2026 StudyVerse · UI prototype — authentication is simulated.</p>
      </div>

      <aside className="relative hidden overflow-hidden bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        <div className="bg-grid-faint absolute inset-0 opacity-40" />
        <div className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-brand-400/20 blur-2xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/25">
            JEE Main · JEE Advanced · MHT-CET
          </span>
          <h2 className="mt-6 max-w-md text-4xl leading-tight font-extrabold text-white">Your entrance prep, organised in one place.</h2>
          <ul className="mt-8 space-y-4 text-brand-50">
            {["Recorded lessons that remember where you stopped", "NTA-style tests with instant, section-wise results", "One all-access plan — activated after a quick payment check"].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 size-5 shrink-0 text-brand-200" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <figure className="relative rounded-2xl bg-white/10 p-6 ring-1 ring-white/20 backdrop-blur-sm">
          <Quote className="size-7 text-brand-200" />
          <blockquote className="mt-3 text-base leading-relaxed text-white">
            “The mock interface felt exactly like the real exam. By test day I wasn&apos;t thinking about buttons — only questions.”
          </blockquote>
          <figcaption className="mt-4 flex items-center justify-between">
            <span>
              <span className="block text-sm font-bold text-white">Aditi R.</span>
              <span className="block text-xs text-brand-100">JEE Main 2026 aspirant (placeholder testimonial)</span>
            </span>
            <span className="flex">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </span>
          </figcaption>
        </figure>
      </aside>
      <PrototypeToolbar />
    </div>
  );
}
