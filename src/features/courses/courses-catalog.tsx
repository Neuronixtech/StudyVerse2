"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BookOpen, Search, SlidersHorizontal, X } from "lucide-react";
import { CourseCard } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, SkeletonCards } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { Drawer } from "@/components/ui/modal";
import { courseProgress, courseStats, publishedCourses } from "@/lib/access";
import { useSession, useSimulatedLoad } from "@/lib/hooks";
import { EXAMS, SUBJECTS } from "@/lib/mock/catalog";
import type { CourseLevel, ExamId, SubjectId } from "@/lib/types";
import { cn } from "@/lib/utils";

type Sort = "popular" | "rating" | "newest" | "shortest";

export function CoursesCatalog() {
  const params = useSearchParams();
  // Re-mount when the URL query changes (e.g. header search while already on this page)
  return <Catalog key={params.toString()} initialQ={params.get("q") ?? ""} initialExam={(params.get("exam") as ExamId) ?? ""} />;
}

function Catalog({ initialQ, initialExam }: { initialQ: string; initialExam: ExamId | "" }) {
  const { state, learner, sub } = useSession();
  const [q, setQ] = useState(initialQ);
  const [exam, setExam] = useState<ExamId | "">(initialExam);
  const [subjects, setSubjects] = useState<SubjectId[]>([]);
  const [level, setLevel] = useState<CourseLevel | "">("");
  const [sort, setSort] = useState<Sort>("popular");
  const [inProgressOnly, setInProgressOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const load = useSimulatedLoad("courses");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = publishedCourses(state).filter((c) => {
      if (needle && !`${c.title} ${c.subtitle} ${c.instructor.name} ${c.modules.map((m) => m.title).join(" ")}`.toLowerCase().includes(needle)) return false;
      if (exam && !c.examIds.includes(exam)) return false;
      if (subjects.length && !subjects.some((s) => c.subjectIds.includes(s))) return false;
      if (level && c.level !== level) return false;
      if (inProgressOnly && !courseProgress(state, learner?.id, c).started) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "newest") return b.createdAt - a.createdAt;
      if (sort === "shortest") return courseStats(a).totalSec - courseStats(b).totalSec;
      return b.enrolled - a.enrolled;
    });
  }, [state, q, exam, subjects, level, sort, inProgressOnly, learner?.id]);

  const activeFilters = [exam, level, inProgressOnly ? "x" : "", ...subjects].filter(Boolean).length;
  const clear = () => {
    setQ("");
    setExam("");
    setSubjects([]);
    setLevel("");
    setInProgressOnly(false);
  };

  const filterPanel = (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2.5 text-xs font-bold tracking-wide text-slate-500 uppercase">Exam</legend>
        <div className="space-y-1">
          {[{ id: "" as const, name: "All exams" }, ...EXAMS.filter((e) => !e.comingSoon)].map((e) => (
            <label key={e.id || "all"} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="radio" name="exam" checked={exam === e.id} onChange={() => setExam(e.id)} className="size-4 accent-brand-600" />
              <span className={cn("font-medium", exam === e.id ? "text-ink" : "text-slate-600")}>{e.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2.5 text-xs font-bold tracking-wide text-slate-500 uppercase">Subject</legend>
        <div className="space-y-1">
          {SUBJECTS.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={subjects.includes(s.id)}
                onChange={() => setSubjects((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                className="size-4 rounded accent-brand-600"
              />
              <span className={cn("font-medium", subjects.includes(s.id) ? "text-ink" : "text-slate-600")}>{s.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2.5 text-xs font-bold tracking-wide text-slate-500 uppercase">Level</legend>
        <Select value={level} onChange={(e) => setLevel(e.target.value as CourseLevel | "")} aria-label="Level">
          <option value="">Any level</option>
          <option>Foundation</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </Select>
      </fieldset>
      {learner && (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-800">
          <input type="checkbox" checked={inProgressOnly} onChange={(e) => setInProgressOnly(e.target.checked)} className="size-4 rounded accent-brand-600" />
          Only courses I&apos;ve started
        </label>
      )}
      {activeFilters > 0 && (
        <button type="button" onClick={clear} className="text-sm font-semibold text-brand-700 hover:underline">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="container-page grid grid-cols-1 gap-8 py-10 lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="sticky top-24 rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="mb-5 flex items-center gap-2 text-sm font-bold text-ink">
            <SlidersHorizontal className="size-4" /> Filters
          </p>
          {filterPanel}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search courses</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by course, topic or instructor"
              className="h-11 w-full rounded-xl border border-line-strong bg-white pr-10 pl-10 text-sm text-ink shadow-xs outline-none focus:border-brand-500 focus:shadow-ring"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-ink" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" className="h-11 lg:hidden" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal /> Filters
              {activeFilters > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] text-white">{activeFilters}</span>}
            </Button>
            <div className="w-44">
              <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort courses" className="h-11 rounded-xl">
                <option value="popular">Most popular</option>
                <option value="rating">Highest rated</option>
                <option value="newest">Newest</option>
                <option value="shortest">Shortest first</option>
              </Select>
            </div>
          </div>
        </div>

        <p className="mt-5 mb-5 text-sm text-slate-500" aria-live="polite">
          {load.status === "success" ? (
            <>
              Showing <strong className="text-ink">{results.length}</strong> course{results.length === 1 ? "" : "s"}
              {exam && <> for {EXAMS.find((e) => e.id === exam)?.name}</>}
            </>
          ) : (
            "Loading courses…"
          )}
        </p>

        {load.status === "loading" ? (
          <SkeletonCards count={6} className="xl:grid-cols-3" />
        ) : load.status === "error" ? (
          <ErrorState title="Couldn't load courses" onRetry={load.retry} />
        ) : results.length === 0 ? (
          <EmptyState
            icon={<BookOpen />}
            title="No courses match your filters"
            description="Try a different search term or clear filters to see every published course."
            action={
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((c) => (
              <CourseCard key={c.id} course={c} sub={sub} progress={courseProgress(state, learner?.id, c)} />
            ))}
          </div>
        )}
      </div>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter courses"
        side="left"
        width="max-w-sm"
        footer={
          <Button block onClick={() => setFiltersOpen(false)}>
            Show {results.length} result{results.length === 1 ? "" : "s"}
          </Button>
        }
      >
        <div className="p-5">{filterPanel}</div>
      </Drawer>
    </div>
  );
}
