import Link from "next/link";
import { BookOpen, CirclePlay, Clock, FileQuestion, Gift, Lock, LockOpen, Star, Timer, Trophy } from "lucide-react";
import type { SubscriptionInfo } from "@/lib/access";
import { courseStats } from "@/lib/access";
import { maxScoreOf, questionCount, totalDurationMin } from "@/lib/exam";
import { examShort, subjectName } from "@/lib/mock/catalog";
import type { Course, Test } from "@/lib/types";
import { cn, formatHoursMinutes, formatNumber } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Avatar, ProgressBar } from "./ui/feedback";
import { buttonClass } from "./ui/button";
import { CourseThumb, SubjectIcon } from "./course-visuals";

export function CourseCard({
  course,
  sub,
  progress,
}: {
  course: Course;
  sub: SubscriptionInfo;
  progress?: { completed: number; total: number; percent: number; started: boolean };
}) {
  const stats = courseStats(course);
  const active = sub.status === "active";
  const started = progress?.started;

  return (
    <article className="group relative flex flex-col rounded-2xl border border-line bg-white p-3 shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift">
      <div className="relative overflow-hidden rounded-xl">
        <CourseThumb theme={course.theme} subjectIds={course.subjectIds} className="aspect-[16/10] transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {course.examIds.slice(0, 2).map((e) => (
            <span key={e} className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-ink shadow-sm backdrop-blur">
              {examShort(e)}
            </span>
          ))}
        </div>
        <div className="absolute top-3 right-3">
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
              <LockOpen className="size-3" /> Full access
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm backdrop-blur">
              <Lock className="size-3" /> Subscription
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-2 pt-4 pb-1">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
          <SubjectIcon subject={course.subjectIds.length === 1 ? course.subjectIds[0] : "mixed"} className="size-3.5" />
          {course.subjectIds.map(subjectName).join(" · ")}
          <span className="text-slate-300">•</span>
          <span className="text-slate-500">{course.level}</span>
        </p>
        <h3 className="text-[15px] leading-snug font-bold text-ink">
          <Link href={`/courses/${course.slug}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
            {course.title}
          </Link>
        </h3>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={course.instructor.name} size="sm" />
            <span className="truncate text-xs font-medium text-slate-600">{course.instructor.name}</span>
          </div>
          {stats.preview && !active && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-brand-700">
              <CirclePlay className="size-3.5" /> Free preview
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed border-line pt-3 text-xs text-slate-500">
          {course.rating > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-ink">
              <Star className="size-3.5 fill-amber-400 text-amber-400" /> {course.rating.toFixed(1)}
              <span className="font-normal text-slate-400">({formatNumber(course.ratingCount)})</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3.5" /> {stats.lessonCount} lessons
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {formatHoursMinutes(stats.totalSec)}
          </span>
        </div>

        {started && progress && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-500">
              <span>
                {progress.completed} of {progress.total} lessons watched
              </span>
              <span className="text-brand-700">{progress.percent}%</span>
            </div>
            <ProgressBar value={progress.percent} size="sm" label={`${course.title} progress`} />
          </div>
        )}

        <div className="mt-auto pt-4">
          <span className={buttonClass({ variant: started ? "primary" : "primary", size: "md", block: true })}>
            {started ? "Continue learning" : active ? "Start learning" : "View course"}
          </span>
        </div>
      </div>
    </article>
  );
}

const KIND_LABEL: Record<Test["kind"], string> = {
  full: "Full mock",
  sectional: "Sectional timed",
  chapter: "Chapter test",
  practice: "Practice",
};

export function TestCard({
  test,
  locked,
  best,
  attempts = 0,
}: {
  test: Test;
  locked: boolean;
  best?: { score: number; max: number };
  attempts?: number;
}) {
  const qCount = questionCount(test);
  const duration = totalDurationMin(test);
  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-white p-5 shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-1 hover:shadow-lift",
        test.isDemo ? "border-brand-300 ring-1 ring-brand-200" : "border-line hover:border-brand-200",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid size-11 place-items-center rounded-xl",
            test.isDemo ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700",
          )}
        >
          {test.isDemo ? <Gift className="size-5" /> : <FileQuestion className="size-5" />}
        </span>
        {test.isDemo ? (
          <Badge tone="brand" dot>
            Free · no sign-up
          </Badge>
        ) : locked ? (
          <Badge tone="slate">
            <Lock /> Subscription
          </Badge>
        ) : (
          <Badge tone="green">
            <LockOpen /> Included
          </Badge>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone="violet" size="xs">
          {KIND_LABEL[test.kind]}
        </Badge>
        {test.examId && (
          <Badge tone="sky" size="xs">
            {examShort(test.examId)}
          </Badge>
        )}
        {test.timingMode === "sectional" && (
          <Badge tone="amber" size="xs">
            Section timers
          </Badge>
        )}
      </div>

      <h3 className="mt-3 text-[15px] leading-snug font-bold text-ink">
        <Link href={`/tests/${test.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
          {test.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{test.description}</p>

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Questions</dt>
          <dd className="text-sm font-bold text-ink">{qCount}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Duration</dt>
          <dd className="inline-flex items-center gap-1 text-sm font-bold text-ink">
            <Timer className="size-3.5 text-slate-400" />
            {duration}m
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Max marks</dt>
          <dd className="text-sm font-bold text-ink">{maxScoreOf(test)}</dd>
        </div>
      </dl>

      <div className="mt-auto pt-4">
        {best ? (
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Trophy className="size-3.5 text-amber-500" /> Best: {best.score}/{best.max}
            <span className="font-normal text-slate-400">· {attempts} attempt{attempts === 1 ? "" : "s"}</span>
          </p>
        ) : null}
        <span className={buttonClass({ variant: test.isDemo ? "primary" : locked ? "secondary" : "primary", block: true })}>
          {test.isDemo ? "Attempt free demo" : locked ? "View details" : "View & attempt"}
        </span>
      </div>
    </article>
  );
}
