"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  BookOpen,
  Check,
  CircleCheck,
  CirclePlay,
  Clock,
  FileQuestion,
  Layers,
  Lock,
  MonitorSmartphone,
  RefreshCcw,
  Star,
  Users,
} from "lucide-react";
import { Breadcrumbs } from "@/components/page-banner";
import { CourseThumb } from "@/components/course-visuals";
import { UnlockPrompt } from "@/components/unlock-prompt";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, Card, EmptyState, ProgressBar, Skeleton } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { canWatchLesson, courseProgress, courseStats } from "@/lib/access";
import { useSession } from "@/lib/hooks";
import { examName, subjectName } from "@/lib/mock/catalog";
import type { Lesson } from "@/lib/types";
import { cn, formatClock, formatDate, formatHoursMinutes, formatNumber } from "@/lib/utils";

export function CourseDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const { state, ready, learner, sub } = useSession();
  const [lockedLesson, setLockedLesson] = useState<Lesson | null>(null);
  const [openModules, setOpenModules] = useState<string[] | null>(null);
  const course = state.courses.find((c) => c.slug === slug);

  if (!course || course.status === "draft") {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<BookOpen />}
          title="Course not found"
          description="This course doesn't exist or isn't published yet."
          action={<ButtonLink href="/courses">Browse courses</ButtonLink>}
        />
      </div>
    );
  }

  if (course.status === "archived") {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<Archive />}
          title="This course has been archived"
          description={`“${course.title}” is no longer in the active catalog. Your past progress is preserved in your history.`}
          action={<ButtonLink href="/courses">Explore current courses</ButtonLink>}
        />
      </div>
    );
  }

  const stats = courseStats(course);
  const progress = courseProgress(state, learner?.id, course);
  const active = sub.status === "active";
  const linkedTests = state.tests.filter((t) => t.courseId === course.id && t.published);
  const firstLesson = course.modules[0]?.lessons[0];
  const expanded = openModules ?? course.modules.slice(0, 2).map((m) => m.id);
  const completedIds = new Set(
    state.progress.filter((p) => p.learnerId === learner?.id && p.courseId === course.id && p.completed).map((p) => p.lessonId),
  );

  const primaryLesson = progress.resumeLesson ?? firstLesson;
  const openLesson = (lesson: Lesson) => {
    if (canWatchLesson(lesson, sub)) router.push(`/learn/${course.slug}/${lesson.id}`);
    else setLockedLesson(lesson);
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-linear-to-br from-brand-950 via-brand-900 to-brand-700 text-white">
        <div className="bg-grid-faint absolute inset-0 opacity-50" />
        <div className="absolute -top-32 right-0 size-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="container-page relative grid grid-cols-1 gap-10 py-10 lg:grid-cols-[1fr_380px] lg:py-14">
          <div>
            <Breadcrumbs light items={[{ href: "/", label: "Home" }, { href: "/courses", label: "Courses" }, { label: course.title }]} />
            <div className="mt-5 flex flex-wrap gap-2">
              {course.examIds.map((e) => (
                <span key={e} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
                  {examName(e)}
                </span>
              ))}
              {course.subjectIds.map((s) => (
                <span key={s} className="rounded-full bg-brand-400/20 px-2.5 py-1 text-xs font-semibold text-brand-100 ring-1 ring-brand-300/30">
                  {subjectName(s)}
                </span>
              ))}
              <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-semibold text-amber-100 ring-1 ring-amber-300/30">{course.level}</span>
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance text-white sm:text-4xl lg:text-[44px] lg:leading-tight">{course.title}</h1>
            <p className="mt-3 max-w-2xl text-lg text-brand-50/85">{course.subtitle}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-brand-50/90">
              {course.rating > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <strong className="text-white">{course.rating.toFixed(1)}</strong> ({formatNumber(course.ratingCount)} ratings)
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" /> {formatNumber(course.enrolled)} learners
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCcw className="size-4" /> Updated {formatDate(course.updatedAt)}
              </span>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Avatar name={course.instructor.name} />
              <div>
                <p className="text-sm font-bold text-white">{course.instructor.name}</p>
                <p className="text-xs text-brand-100/80">{course.instructor.title}</p>
              </div>
            </div>
          </div>

          {/* Access card */}
          <div className="lg:row-span-2">
            <div className="overflow-hidden rounded-2xl bg-white text-slate-600 shadow-2xl lg:sticky lg:top-24">
              <div className="relative">
                <CourseThumb theme={course.theme} subjectIds={course.subjectIds} size="lg" className="aspect-video" title={course.title} />
                {stats.preview && (
                  <button
                    type="button"
                    onClick={() => router.push(`/learn/${course.slug}/${stats.preview!.id}`)}
                    className="absolute inset-0 grid place-items-center bg-ink/10 transition-colors hover:bg-ink/25"
                    aria-label={`Watch free preview: ${stats.preview.title}`}
                  >
                    <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-lg">
                      <CirclePlay className="size-5" /> Watch free preview
                    </span>
                  </button>
                )}
              </div>
              <div className="p-5">
                {!ready ? (
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-11 w-full" />
                  </div>
                ) : active ? (
                  <>
                    <Badge tone="green" dot>
                      Included in your subscription
                    </Badge>
                    {progress.started && (
                      <div className="mt-4">
                        <div className="mb-1.5 flex justify-between text-xs font-semibold">
                          <span>
                            {progress.completed} of {progress.total} lessons watched
                          </span>
                          <span className="text-brand-700">{progress.percent}%</span>
                        </div>
                        <ProgressBar value={progress.percent} label="Course progress" />
                      </div>
                    )}
                    {primaryLesson && (
                      <ButtonLink href={`/learn/${course.slug}/${primaryLesson.id}`} block size="lg" className="mt-4">
                        <CirclePlay /> {progress.started ? "Continue learning" : "Start learning"}
                      </ButtonLink>
                    )}
                    {progress.started && primaryLesson && <p className="mt-2 text-center text-xs text-slate-500">Up next: {primaryLesson.title}</p>}
                  </>
                ) : (
                  <>
                    {stats.preview && (
                      <ButtonLink href={`/learn/${course.slug}/${stats.preview.id}`} block size="lg" variant="outline">
                        <CirclePlay /> Watch free preview
                      </ButtonLink>
                    )}
                    <UnlockPrompt learner={learner} sub={sub} next={`/courses/${course.slug}`} what="all lessons" className="mt-4 border-0 bg-slate-50 p-4" />
                  </>
                )}
                <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
                  <li className="flex items-center gap-2.5">
                    <Layers className="size-4 text-brand-600" /> {stats.moduleCount} modules · {stats.lessonCount} lessons
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Clock className="size-4 text-brand-600" /> {formatHoursMinutes(stats.totalSec)} of video
                  </li>
                  {linkedTests.length > 0 && (
                    <li className="flex items-center gap-2.5">
                      <FileQuestion className="size-4 text-brand-600" /> {linkedTests.length} linked practice test{linkedTests.length > 1 ? "s" : ""}
                    </li>
                  )}
                  <li className="flex items-center gap-2.5">
                    <MonitorSmartphone className="size-4 text-brand-600" /> Watch on mobile, tablet & desktop
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page grid grid-cols-1 gap-10 py-12 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="learn-heading">
            <h2 id="learn-heading" className="text-xl font-extrabold">
              What you&apos;ll learn
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-line bg-mist p-5 sm:grid-cols-2">
              {course.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-600" /> {h}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="content-heading">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="content-heading" className="text-xl font-extrabold">
                  Course content
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {stats.moduleCount} modules · {stats.lessonCount} lessons · {formatHoursMinutes(stats.totalSec)}
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-brand-700 hover:underline"
                onClick={() => setOpenModules(expanded.length === course.modules.length ? [] : course.modules.map((m) => m.id))}
              >
                {expanded.length === course.modules.length ? "Collapse all" : "Expand all"}
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
              {course.modules.map((m, mi) => {
                const isOpen = expanded.includes(m.id);
                const done = m.lessons.filter((l) => completedIds.has(l.id)).length;
                return (
                  <div key={m.id} className={cn(mi > 0 && "border-t border-line")}>
                    <h3>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenModules(isOpen ? expanded.filter((x) => x !== m.id) : [...expanded, m.id])}
                        className="flex w-full items-center gap-4 bg-slate-50/70 px-5 py-4 text-left hover:bg-slate-50"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-100 text-sm font-extrabold text-brand-700">{mi + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-ink">{m.title}</span>
                          <span className="text-xs text-slate-500">
                            {m.lessons.length} lessons · {formatHoursMinutes(m.lessons.reduce((a, l) => a + l.durationSec, 0))}
                            {learner && done > 0 && <span className="ml-1.5 font-semibold text-brand-700">· {done} completed</span>}
                          </span>
                        </span>
                        <span className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} aria-hidden>
                          ▾
                        </span>
                      </button>
                    </h3>
                    {isOpen && (
                      <ul>
                        {m.lessons.map((l) => {
                          const can = canWatchLesson(l, sub);
                          const completed = completedIds.has(l.id);
                          return (
                            <li key={l.id} className="border-t border-line/70">
                              <button
                                type="button"
                                onClick={() => openLesson(l)}
                                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-brand-50/50"
                              >
                                <span className={cn("shrink-0", completed ? "text-emerald-600" : can ? "text-brand-600" : "text-slate-400")}>
                                  {completed ? <CircleCheck className="size-5" /> : can ? <CirclePlay className="size-5" /> : <Lock className="size-5" />}
                                </span>
                                <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{l.title}</span>
                                {l.isPreview && (
                                  <Badge tone="brand" size="xs">
                                    Free preview
                                  </Badge>
                                )}
                                <span className="shrink-0 font-mono text-xs text-slate-500">{formatClock(l.durationSec)}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-xl font-extrabold">
              About this course
            </h2>
            <p className="mt-3 leading-relaxed text-slate-600">{course.description}</p>
          </section>

          <section aria-labelledby="instructor-heading">
            <h2 id="instructor-heading" className="text-xl font-extrabold">
              Your instructor
            </h2>
            <Card className="mt-4 flex items-center gap-4 p-5">
              <Avatar name={course.instructor.name} size="xl" />
              <div>
                <p className="text-base font-bold text-ink">{course.instructor.name}</p>
                <p className="text-sm text-slate-500">{course.instructor.title}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                  <Star className="size-4 fill-amber-400 text-amber-400" /> {course.rating.toFixed(1)} instructor rating
                </p>
              </div>
            </Card>
          </section>
        </div>

        {linkedTests.length > 0 && (
          <aside className="space-y-4" aria-labelledby="tests-heading">
            <h2 id="tests-heading" className="text-base font-extrabold">
              Practise this course
            </h2>
            {linkedTests.map((t) => (
              <Link key={t.id} href={`/tests/${t.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition-colors hover:border-brand-300">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <FileQuestion className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{t.title}</span>
                  <span className="text-xs text-slate-500">{t.sections.reduce((a, s) => a + s.questions.length, 0)} questions · {t.durationMin} min</span>
                </span>
                {!active && <Lock className="size-4 text-slate-400" />}
              </Link>
            ))}
          </aside>
        )}
      </div>

      <Modal open={!!lockedLesson} onClose={() => setLockedLesson(null)} title="This lesson is locked" description={lockedLesson?.title} size="sm">
        <UnlockPrompt learner={learner} sub={sub} next={`/courses/${course.slug}`} what="this lesson" className="border-0 p-0" />
        {stats.preview && (
          <p className="mt-4 border-t border-line pt-4 text-sm text-slate-500">
            Meanwhile, watch the free preview:{" "}
            <Link href={`/learn/${course.slug}/${stats.preview.id}`} className="font-semibold text-brand-700 hover:underline">
              {stats.preview.title}
            </Link>
          </p>
        )}
      </Modal>
    </>
  );
}
