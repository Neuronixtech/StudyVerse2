import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "../brand";

const COLUMNS = [
  {
    title: "Learn",
    links: [
      { href: "/courses", label: "All courses" },
      { href: "/tests", label: "Practice tests" },
      { href: "/tests/t-demo", label: "Free demo test" },
      { href: "/subscribe", label: "Pricing" },
    ],
  },
  {
    title: "Exams",
    links: [
      { href: "/courses?exam=jee-main", label: "JEE Main" },
      { href: "/courses?exam=jee-advanced", label: "JEE Advanced" },
      { href: "/courses?exam=mht-cet", label: "MHT-CET" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Create account" },
      { href: "/dashboard", label: "Learner dashboard" },
      { href: "/admin/login", label: "Admin console" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-brand-950 text-brand-100/80">
      <div className="container-page grid grid-cols-1 gap-10 py-14 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed">
            Structured recorded courses, NTA-style practice tests and one simple all-access subscription for engineering entrance aspirants across India.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2.5">
              <Mail className="size-4 text-brand-300" /> support@studyverse.example
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="size-4 text-brand-300" /> +91 20 4000 1234
            </li>
            <li className="flex items-center gap-2.5">
              <MapPin className="size-4 text-brand-300" /> Pune, Maharashtra
            </li>
          </ul>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-bold tracking-wide text-white">{col.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 StudyVerse. UI prototype — all names, figures and data are mock content.</p>
          <p className="text-brand-200/60">Made for JEE Main · JEE Advanced · MHT-CET aspirants</p>
        </div>
      </div>
    </footer>
  );
}
