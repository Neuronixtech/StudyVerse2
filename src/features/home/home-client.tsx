"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, Search } from "lucide-react";
import { CourseCard, TestCard } from "@/components/cards";
import { ButtonLink } from "@/components/ui/button";
import { attemptsFor, bestAttempt, courseProgress, publishedCourses, testAccess } from "@/lib/access";
import { useSession } from "@/lib/hooks";
import { EXAMS } from "@/lib/mock/catalog";
import { cn, formatINR } from "@/lib/utils";

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [exam, setExam] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (exam) params.set("exam", exam);
        router.push(`/courses${params.size ? `?${params}` : ""}`);
      }}
      className="flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-line bg-white p-2 shadow-card sm:flex-row sm:items-center sm:rounded-full sm:pl-5"
    >
      <label className="flex flex-1 items-center gap-2.5 px-3 sm:px-0">
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
        <span className="sr-only">Search courses</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search kinematics, organic, calculus…"
          className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
        />
      </label>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="hero-exam">
          Exam category
        </label>
        <select
          id="hero-exam"
          value={exam}
          onChange={(e) => setExam(e.target.value)}
          className="h-10 flex-1 rounded-full border-0 bg-slate-50 px-3 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-brand-300 sm:flex-none sm:border-l sm:border-line sm:bg-transparent"
        >
          <option value="">All exams</option>
          {EXAMS.filter((e) => !e.comingSoon).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 shrink-0 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
          Search courses
        </button>
      </div>
    </form>
  );
}

export function PopularCourses() {
  const { state, learner, sub } = useSession();
  const courses = publishedCourses(state)
    .filter((c) => c.featured)
    .slice(0, 6);
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} sub={sub} progress={courseProgress(state, learner?.id, c)} />
      ))}
    </div>
  );
}

export function TestsShowcase() {
  const { state, learner, sub } = useSession();
  const tests = state.tests
    .filter((t) => t.published)
    .sort((a, b) => Number(b.isDemo) - Number(a.isDemo))
    .slice(0, 3);
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {tests.map((t) => {
        const attempts = attemptsFor(state, t.id, learner?.id);
        const best = bestAttempt(attempts);
        return (
          <TestCard
            key={t.id}
            test={t}
            locked={!testAccess(t, learner?.id ?? null, sub, attempts.length).allowed}
            attempts={attempts.length}
            best={best ? { score: best.result.score, max: best.result.maxScore } : undefined}
          />
        );
      })}
    </div>
  );
}

export function PricingTeaser() {
  const { state } = useSession();
  const plans = state.plans.filter((p) => p.enabled);
  const monthly = state.plans.find((p) => p.days === 30)?.price ?? 0;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {plans.map((p) => {
        const popular = p.days === 90;
        const perMonth = Math.round(p.price / (p.days / 30));
        const save = monthly ? Math.round((1 - perMonth / monthly) * 100) : 0;
        return (
          <div
            key={p.days}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-white p-6 shadow-card",
              popular ? "border-brand-500 ring-4 ring-brand-100" : "border-line",
            )}
          >
            {popular && (
              <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white shadow">Most popular</span>
            )}
            <p className="text-sm font-bold text-brand-700">{p.label}</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold tracking-tight text-ink">{formatINR(p.price)}</span>
              <span className="text-sm text-slate-500">/ {p.days} days</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ≈ {formatINR(perMonth)} per month{save > 0 && <span className="ml-1.5 font-semibold text-emerald-600">Save {save}%</span>}
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {["Every published course & lesson", "All regular practice tests", "Detailed solutions when released", "Progress & attempt history"].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-600" /> {f}
                </li>
              ))}
            </ul>
            <ButtonLink href={`/subscribe?plan=${p.days}`} variant={popular ? "primary" : "outline"} block className="mt-6">
              Choose {p.label.toLowerCase()} <ArrowRight />
            </ButtonLink>
          </div>
        );
      })}
    </div>
  );
}
