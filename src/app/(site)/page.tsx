import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  CirclePlay,
  Clock,
  Gift,
  GraduationCap,
  LayoutGrid,
  MonitorSmartphone,
  Quote,
  Sparkles,
  Star,
  Timer,
  Users,
  WalletCards,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/badge";
import { HeroSearch, PopularCourses, PricingTeaser, TestsShowcase } from "@/features/home/home-client";
import { EXAMS } from "@/lib/mock/catalog";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureBand />

      <section className="container-page py-20 lg:py-24" aria-labelledby="popular-heading">
        <SectionHeading
          eyebrow="Popular courses"
          id="popular-heading"
          title={
            <>
              Explore our most <span className="text-brand-600">popular courses</span>
            </>
          }
          description="Concept-first recorded courses built around the JEE and MHT-CET syllabus. Every course has a free preview lesson."
        />
        <div className="mt-12">
          <PopularCourses />
        </div>
        <div className="mt-10 flex justify-center">
          <ButtonLink href="/courses" variant="outline" pill size="lg">
            View all courses <ArrowRight />
          </ButtonLink>
        </div>
      </section>

      <ExamBand />
      <DemoSection />
      <WhySection />

      <section className="bg-mist py-20 lg:py-24" aria-labelledby="tests-heading">
        <div className="container-page">
          <SectionHeading
            eyebrow="Practice tests"
            id="tests-heading"
            title={
              <>
                Practise in a real <span className="whitespace-nowrap text-brand-600">NTA-style</span> exam interface
              </>
            }
            description="Full mocks, chapter tests and sectional-timed papers with instant scores and detailed solutions."
          />
          <div className="mt-12">
            <TestsShowcase />
          </div>
          <div className="mt-10 flex justify-center">
            <ButtonLink href="/tests" variant="outline" pill size="lg">
              Browse all tests <ArrowRight />
            </ButtonLink>
          </div>
        </div>
      </section>

      <Testimonials />
      <NumbersBand />

      <section className="container-page py-20 lg:py-24" aria-labelledby="pricing-heading">
        <SectionHeading
          eyebrow="One simple plan"
          id="pricing-heading"
          title={
            <>
              One subscription. <span className="text-brand-600">Everything unlocked.</span>
            </>
          }
          description="No per-course pricing. Pick a duration, pay via UPI or bank transfer, and get access once our team verifies your payment."
        />
        <div className="mx-auto mt-14 max-w-5xl">
          <PricingTeaser />
        </div>
      </section>

      <Faq />
      <CtaStrip />
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  id: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-base text-slate-500">{description}</p>
    </div>
  );
}

/* ------------------------------- Hero ------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-dots absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <div className="absolute inset-x-0 top-0 -z-20 h-full bg-linear-to-b from-brand-50/80 via-white to-white" />
      <div className="container-page grid grid-cols-1 items-center gap-12 pt-12 pb-28 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-36">
        <div className="animate-slide-up">
          <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-xs">
            <Sparkles className="size-3.5" /> JEE Main · JEE Advanced · MHT-CET
          </span>
          <h1 className="mt-5 text-4xl leading-[1.1] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[56px]">
            Crack your engineering entrance with <span className="text-brand-600">structured preparation</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Recorded courses by experienced faculty, NTA-style practice tests and one all-access subscription — everything an aspirant needs, in one place.
          </p>
          <div className="mt-8">
            <HeroSearch />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ButtonLink href="/tests/t-demo" variant="dark" pill>
              <Gift /> Try the free demo test
            </ButtonLink>
            <span className="text-sm text-slate-500">No sign-up needed</span>
          </div>
          <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {[
              { icon: <Users />, value: "25,000+", label: "Aspirants" },
              { icon: <BookOpen />, value: "120+", label: "Video lessons" },
              { icon: <LayoutGrid />, value: "40+", label: "Practice tests" },
              { icon: <Star />, value: "4.8/5", label: "Avg. rating" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700 [&_svg]:size-4">{s.icon}</span>
                <div>
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="text-base font-extrabold text-ink">{s.value}</dd>
                  <dd className="text-xs text-slate-500">{s.label}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  const palette = ["a", "a", "r", "a", "m", "a", "v", "n", "a", "r", "mc", "n", "a", "n", "n"];
  const color: Record<string, string> = {
    a: "bg-q-answered text-white",
    r: "bg-q-notanswered text-white",
    m: "bg-q-review text-white",
    mc: "bg-q-review text-white ring-2 ring-emerald-300",
    v: "bg-white text-ink ring-2 ring-brand-500",
    n: "bg-slate-100 text-slate-500",
  };
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none" aria-hidden>
      <div className="absolute top-1/2 left-1/2 aspect-square w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-linear-to-br from-brand-200 via-brand-100 to-white" />
      <div className="absolute top-[8%] right-[6%] size-16 rounded-full border-[10px] border-brand-200/70" />
      <div className="absolute bottom-[10%] left-[4%] size-10 rounded-full bg-amber-300/70" />

      {/* Exam window */}
      <div className="relative mx-auto mt-16 w-[86%] overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-brand-700 px-4 py-2.5 text-white">
          <span className="text-xs font-semibold">JEE Main Mock · Physics</span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2 py-0.5 font-mono text-xs font-bold">
            <Timer className="size-3.5" /> 00:42:18
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-4 p-4">
          <div>
            <p className="text-[11px] font-bold text-brand-700">Question 7 · Single correct</p>
            <p className="mt-1.5 text-xs leading-relaxed font-medium text-ink">A ball is projected at 30° with 20 m/s. The maximum height reached is:</p>
            <div className="mt-3 space-y-1.5">
              {["5 m", "10 m", "15 m", "20 m"].map((o, i) => (
                <div
                  key={o}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium",
                    i === 0 ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line text-slate-600",
                  )}
                >
                  <span className={cn("grid size-3.5 place-items-center rounded-full border", i === 0 ? "border-brand-600" : "border-slate-300")}>
                    {i === 0 && <span className="size-1.5 rounded-full bg-brand-600" />}
                  </span>
                  {o}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-1.5">
              <span className="rounded-md bg-brand-600 px-2 py-1 text-[10px] font-bold text-white">Save & Next</span>
              <span className="rounded-md bg-violet-600 px-2 py-1 text-[10px] font-bold text-white">Mark for Review</span>
            </div>
          </div>
          <div className="w-[104px]">
            <p className="text-[10px] font-bold text-slate-500">Palette</p>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              {palette.map((p, i) => (
                <span key={i} className={cn("grid size-5 place-items-center rounded text-[9px] font-bold", color[p])}>
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges, as in the reference design */}
      <div className="absolute top-0 left-0 flex animate-float items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 shadow-lift">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-100 text-brand-700">
          <Users className="size-4" />
        </span>
        <div>
          <p className="text-sm font-extrabold text-ink">12,000+</p>
          <p className="text-[11px] text-slate-500">Mock tests taken</p>
        </div>
      </div>
      <div className="absolute right-0 bottom-[16%] flex animate-float items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-lift [animation-delay:1.5s] sm:-right-2">
        <span className="grid size-9 place-items-center rounded-xl bg-amber-100 text-amber-600">
          <Star className="size-4 fill-amber-400" />
        </span>
        <div>
          <p className="text-sm font-extrabold text-ink">4.8 / 5</p>
          <p className="text-[11px] text-slate-500">Course rating</p>
        </div>
      </div>
      <div className="absolute -bottom-6 left-[8%] flex animate-float items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lift [animation-delay:3s]">
        <span className="grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CirclePlay className="size-5" />
        </span>
        <div className="w-36">
          <p className="text-xs font-bold text-ink">Projectile motion</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[68%] rounded-full bg-brand-500" />
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Resume at 18:40</p>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Feature band --------------------------- */

function FeatureBand() {
  const features = [
    { icon: <BookOpen />, title: "Structured courses", text: "Course → modules → lessons, mapped to the syllabus." },
    { icon: <Timer />, title: "NTA-style tests", text: "Palette, timers, review marking — exactly like the real CBT." },
    { icon: <WalletCards />, title: "One all-access plan", text: "Every course and test with a single subscription." },
    { icon: <MonitorSmartphone />, title: "Learn on any device", text: "Lessons and exams work on phone, tablet and desktop." },
  ];
  return (
    <section className="container-page relative z-10 -mt-16 lg:-mt-20" aria-label="Highlights">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-linear-to-r from-brand-600 via-brand-600 to-brand-700 p-1 shadow-lift sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <div key={f.title} className={cn("flex items-start gap-4 p-6 text-white", i > 0 && "lg:border-l lg:border-white/15")}>
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-brand-700 shadow-sm [&_svg]:size-5">{f.icon}</span>
            <div>
              <h3 className="text-base font-bold text-white">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-brand-50/85">{f.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------- Exam band ----------------------------- */

function ExamBand() {
  return (
    <section className="bg-linear-to-r from-brand-700 via-brand-600 to-brand-700" aria-label="Exams we cover">
      <div className="container-page flex flex-col items-center gap-6 py-8 lg:flex-row lg:justify-between">
        <div className="text-center lg:text-left">
          <p className="text-lg font-extrabold text-white">Rated “Excellent” by aspirants</p>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-brand-50 lg:justify-start">
            <span className="flex">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </span>
            4.8 average across 6,500+ course ratings
          </p>
        </div>
        <ul className="flex flex-wrap justify-center gap-3">
          {EXAMS.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 shadow-sm">
              <GraduationCap className="size-4 text-brand-600" />
              <span className="text-sm font-bold text-ink">{e.name}</span>
              {e.comingSoon && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Soon</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ----------------------------- Demo test ----------------------------- */

function DemoSection() {
  const legend = [
    { cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", label: "Not visited" },
    { cls: "bg-q-notanswered text-white", label: "Not answered" },
    { cls: "bg-q-answered text-white", label: "Answered" },
    { cls: "bg-q-review text-white", label: "Marked for review" },
    { cls: "bg-q-review text-white ring-2 ring-emerald-300", label: "Answered & marked" },
  ];
  return (
    <section className="container-page py-20 lg:py-24" aria-labelledby="demo-heading">
      <div className="grid grid-cols-1 items-center gap-12 overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10 lg:grid-cols-2 lg:p-14">
        <div className="relative order-2 lg:order-1">
          <div className="absolute -inset-6 -z-10 rounded-3xl bg-brand-50" />
          <div className="rounded-2xl bg-white p-5 shadow-lift ring-1 ring-line">
            <p className="text-sm font-bold text-ink">Question palette legend</p>
            <ul className="mt-4 space-y-3">
              {legend.map((l, i) => (
                <li key={l.label} className="flex items-center gap-3 text-sm">
                  <span className={cn("grid size-8 place-items-center rounded-lg text-xs font-bold", l.cls)}>{i + 1}</span>
                  <span className="font-medium text-slate-700">{l.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "Single correct", v: "MCQ" },
                { k: "Multi-select", v: "MSQ" },
                { k: "Numerical", v: "NUM" },
              ].map((t) => (
                <div key={t.k} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-extrabold text-brand-700">{t.v}</p>
                  <p className="text-[11px] text-slate-500">{t.k}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <Eyebrow>Free demo test</Eyebrow>
          <h2 id="demo-heading" className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Experience the exam before exam day
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            Our free demo recreates the NTA computer-based test — instructions screen, countdown timer, section tabs, question palette and review marking. See your score the moment you submit.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {["No account or payment needed", "All three question types: MCQ, multi-select, numerical", "Instant score with section-wise breakdown", "Sign up afterwards to save the result to your history"].map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                  <Check className="size-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/tests/t-demo" size="lg" pill>
              Start the free demo <ArrowRight />
            </ButtonLink>
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Clock className="size-4" /> 20 minutes · 9 questions
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Why us ------------------------------ */

function WhySection() {
  return (
    <section className="container-page pb-20 lg:pb-24" aria-labelledby="why-heading">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold tracking-widest text-brand-600 uppercase">Why choose us</p>
          <h2 id="why-heading" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Empowering aspirants across India
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-500">
            StudyVerse is built for focused, self-paced preparation. Learn a concept, practise it under exam conditions, then review exactly where you lost marks.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              "Lifetime-style access while subscribed",
              "Taught by experienced JEE faculty",
              "Resume lessons where you left off",
              "Section-wise performance analysis",
              "Historical results never change",
              "Works great on mobile data",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand-600" /> {f}
              </li>
            ))}
          </ul>
          <ButtonLink href="/courses" className="mt-8" pill>
            Explore courses <ArrowRight />
          </ButtonLink>
        </div>
        <div className="relative" aria-hidden>
          <div className="overflow-hidden rounded-3xl bg-linear-to-br from-ink via-brand-950 to-brand-800 p-6 shadow-2xl sm:p-8">
            <div className="bg-grid-faint absolute inset-0 rounded-3xl opacity-40" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-200">
                <span className="size-2 rounded-full bg-red-400" /> Now playing · Mechanics Masterclass
              </div>
              <p className="mt-2 text-xl font-bold text-white">Projectile motion</p>
              <div className="mt-6 grid aspect-video place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                <span className="grid size-16 place-items-center rounded-full bg-white text-brand-700 shadow-xl">
                  <CirclePlay className="size-8" />
                </span>
              </div>
              <div className="mt-5 flex items-center gap-3 text-xs text-white/70">
                <span className="font-mono">18:40</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full w-[68%] rounded-full bg-brand-400" />
                </div>
                <span className="font-mono">27:40</span>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-14 left-6 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lift sm:left-10">
            <span className="grid size-10 place-items-center rounded-full bg-brand-600 text-white">
              <CirclePlay className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">Watch how it works</p>
              <p className="text-xs text-slate-500">2 min overview</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Testimonials --------------------------- */

function Testimonials() {
  const items = [
    { name: "Aditi R.", meta: "JEE Main 2026 · 99.2 percentile", quote: "The mock tests feel exactly like the NTA interface. By exam day the palette and timer were second nature, so I could focus only on questions." },
    { name: "Harsh V.", meta: "JEE Advanced aspirant · Kota", quote: "Mechanics finally clicked with the free-body diagram drills. Being able to resume lessons on my phone during travel was a big help." },
    { name: "Pooja K.", meta: "MHT-CET 2026 · Pune", quote: "One subscription for everything is so simple. Payment by UPI was approved the same evening and I could start right away." },
  ];
  return (
    <section className="container-page py-20 lg:py-24" aria-labelledby="testimonials-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold tracking-widest text-brand-600 uppercase">Student reviews</p>
        <h2 id="testimonials-heading" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          What our students say
        </h2>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((t, i) => (
          <figure
            key={t.name}
            className={cn(
              "flex flex-col rounded-2xl border p-6 shadow-card",
              i === 1 ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white",
            )}
          >
            <Quote className={cn("size-8", i === 1 ? "text-brand-200" : "text-brand-200")} />
            <div className="mt-3 flex">
              {Array.from({ length: 5 }, (_, s) => (
                <Star key={s} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className={cn("mt-3 flex-1 text-sm leading-relaxed", i === 1 ? "text-brand-50" : "text-slate-600")}>“{t.quote}”</blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <span className={cn("grid size-10 place-items-center rounded-full text-sm font-bold", i === 1 ? "bg-white text-brand-700" : "bg-brand-100 text-brand-800")}>
                {t.name[0]}
              </span>
              <span>
                <span className={cn("block text-sm font-bold", i === 1 ? "text-white" : "text-ink")}>{t.name}</span>
                <span className={cn("block text-xs", i === 1 ? "text-brand-100" : "text-slate-500")}>{t.meta}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">Testimonials and figures on this page are placeholder content for the prototype.</p>
    </section>
  );
}

function NumbersBand() {
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-brand-600 to-brand-800" aria-label="StudyVerse by numbers">
      <div className="bg-grid-faint absolute inset-0 opacity-40" />
      <div className="container-page relative py-14">
        <h2 className="text-center text-2xl font-extrabold text-white">StudyVerse by numbers</h2>
        <dl className="mt-8 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {[
            { v: "500+", l: "Hours of recorded lessons" },
            { v: "45+", l: "Expert-curated tests" },
            { v: "30+", l: "Chapters covered" },
            { v: "5,00,000+", l: "Questions attempted" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <dt className="sr-only">{s.l}</dt>
              <dd className="text-3xl font-extrabold text-white sm:text-4xl">{s.v}</dd>
              <dd className="mt-1 text-sm text-brand-100">{s.l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------- FAQ ------------------------------- */

function Faq() {
  const faqs = [
    { q: "How does the subscription work?", a: "There is one all-access plan available for 30, 90 or 365 days. It unlocks every published course lesson and every regular practice test while it is active." },
    { q: "How do I pay?", a: "Pay outside StudyVerse via UPI or bank transfer, then submit the transaction reference on the Subscribe page. Our team verifies the payment and activates your plan — usually within 24 hours." },
    { q: "What happens when my subscription expires?", a: "Your account, lesson progress and exam history stay safe. Paid lessons and regular tests lock until you renew; free previews and the demo test remain available." },
    { q: "Can I renew before my plan ends?", a: "Yes. A renewal approved while you are active extends your existing expiry date, so you never lose unused days." },
    { q: "Do I need an account for the demo test?", a: "No. Anyone can attempt the free demo test and see the result instantly. Sign in afterwards if you want to keep the result in your history." },
  ];
  return (
    <section className="bg-mist py-20 lg:py-24" aria-labelledby="faq-heading">
      <div className="container-page grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Eyebrow>FAQ</Eyebrow>
          <h2 id="faq-heading" className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-3 text-slate-500">Can&apos;t find an answer? Write to support@studyverse.example.</p>
        </div>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-line bg-white px-5 shadow-xs open:shadow-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold text-ink [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaStrip() {
  return (
    <section className="container-page py-16">
      <div className="flex flex-col items-start gap-6 rounded-3xl bg-ink p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Ready to start preparing?</h2>
          <p className="mt-2 text-slate-300">Create a free account, watch preview lessons and take the demo test today.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/signup" variant="white" size="lg" pill>
            Create free account
          </ButtonLink>
          <ButtonLink href="/courses" size="lg" pill className="bg-white/10 hover:bg-white/20">
            Browse courses
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
