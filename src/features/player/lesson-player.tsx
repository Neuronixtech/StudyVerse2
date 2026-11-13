"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CirclePlay,
  Download,
  ExternalLink,
  FileVideo,
  Lock,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/brand";
import { UnlockPrompt } from "@/components/unlock-prompt";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, ProgressBar, SimulatedNote, Skeleton } from "@/components/ui/feedback";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { allLessons, canWatchLesson, courseProgress } from "@/lib/access";
import { useSession } from "@/lib/hooks";
import { setLessonCompleted } from "@/lib/store";
import type { Course, Lesson } from "@/lib/types";
import { cn, formatClock } from "@/lib/utils";
import { SimPlayer } from "./sim-player";

export function LessonPlayer({ slug, lessonId }: { slug: string; lessonId: string }) {
  const router = useRouter();
  const { state, ready, learner, sub } = useSession();
  const [tab, setTab] = useState<"overview" | "resources">("overview");
  const [outlineOpen, setOutlineOpen] = useState(false);

  const course = state.courses.find((c) => c.slug === slug);
  const lessons = course ? allLessons(course) : [];
  const index = lessons.findIndex((l) => l.id === lessonId);
  const lesson = lessons[index];

  if (!course || !lesson || course.status === "draft") {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<BookOpen />}
          title="Lesson not found"
          description="This lesson may have been moved or removed."
          action={<ButtonLink href={course ? `/courses/${course.slug}` : "/courses"}>Back to course</ButtonLink>}
        />
      </div>
    );
  }

  const lessonModule = course.modules.find((m) => m.lessons.some((l) => l.id === lesson.id))!;
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const can = canWatchLesson(lesson, sub);
  const progress = courseProgress(state, learner?.id, course);
  const entry = state.progress.find((p) => p.learnerId === learner?.id && p.lessonId === lesson.id);
  const completed = entry?.completed ?? false;
  const go = (l: Lesson) => router.push(`/learn/${course.slug}/${l.id}`);

  const toggleComplete = () => {
    if (!learner) return;
    setLessonCompleted(learner.id, course.id, lesson.id, !completed);
    toast({
      title: completed ? "Marked as not completed" : "Lesson marked as complete",
      description: completed ? undefined : next ? `Up next: ${next.title}` : "You've reached the end of this course.",
      tone: completed ? "info" : "success",
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* Focused player header */}
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          <Link href={`/courses/${course.slug}`} className="flex items-center gap-2 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-ink" aria-label="Back to course page">
            <ArrowLeft className="size-5" />
          </Link>
          <Link href="/" aria-label="StudyVerse home" className="hidden sm:block">
            <LogoMark className="size-8" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{course.title}</p>
            <p className="truncate text-xs text-slate-500">
              {lessonModule.title} · Lesson {index + 1} of {lessons.length}
            </p>
          </div>
          {ready && learner && (
            <div className="hidden w-48 md:block">
              <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-500">
                <span>
                  {progress.completed}/{progress.total} completed
                </span>
                <span className="text-brand-700">{progress.percent}%</span>
              </div>
              <ProgressBar value={progress.percent} size="sm" label="Course progress" />
            </div>
          )}
          <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setOutlineOpen((o) => !o)} aria-expanded={outlineOpen}>
            {outlineOpen ? <X /> : <BookOpen />} <span className="hidden sm:inline">Contents</span>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 flex-1 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 p-3 sm:p-5 lg:p-8">
          {outlineOpen && (
            <div className="mb-4 overflow-hidden rounded-2xl border border-line bg-white lg:hidden">
              <Outline course={course} currentId={lesson.id} learnerId={learner?.id} onPick={(l) => { setOutlineOpen(false); go(l); }} />
            </div>
          )}

          {!ready ? (
            <Skeleton className="aspect-video w-full rounded-2xl" />
          ) : can ? (
            <SimPlayer
              key={`${lesson.id}:${learner?.id ?? "guest"}`}
              lesson={lesson}
              courseId={course.id}
              learnerId={learner?.id ?? null}
              initialPosition={entry?.positionSec ?? 0}
              alreadyCompleted={completed}
              nextLabel={next ? (canWatchLesson(next, sub) ? `Next: ${next.title}` : "Next lesson (locked)") : undefined}
              onNext={next ? () => go(next) : undefined}
            />
          ) : (
            <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-ink via-brand-950 to-brand-900 p-4 shadow-xl">
              <div className="bg-grid-faint absolute inset-0 opacity-30" />
              <div className="relative w-full max-w-md">
                <div className="mb-4 flex items-center justify-center gap-2 text-sm font-semibold text-white/80">
                  <Lock className="size-4" /> This lesson is part of the subscription
                </div>
                <UnlockPrompt learner={learner} sub={sub} next={`/learn/${course.slug}/${lesson.id}`} what="this lesson" tone="dark" />
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {lesson.isPreview && <Badge tone="brand">Free preview</Badge>}
                {completed && (
                  <Badge tone="green">
                    <CircleCheck /> Completed
                  </Badge>
                )}
              </div>
              <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">{lesson.title}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {lessonModule.title} · {formatClock(lesson.durationSec)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {learner && can ? (
                <Button variant={completed ? "subtle" : "outline"} onClick={toggleComplete} aria-pressed={completed}>
                  <CircleCheck /> {completed ? "Completed" : "Mark as complete"}
                </Button>
              ) : !learner && can ? (
                <ButtonLink href={`/login?next=/learn/${course.slug}/${lesson.id}`} variant="secondary">
                  Sign in to track progress
                </ButtonLink>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-2">
            <Button variant="ghost" disabled={!prev} onClick={() => prev && go(prev)} className="min-w-0">
              <ChevronLeft /> <span className="truncate">{prev ? <><span className="hidden sm:inline">Previous: </span>{prev.title}</> : "Previous"}</span>
            </Button>
            <Button variant={next ? "primary" : "ghost"} disabled={!next} onClick={() => next && go(next)} className="min-w-0">
              <span className="truncate">{next ? <><span className="hidden sm:inline">Next: </span>{next.title}</> : "Last lesson"}</span>
              {next && !canWatchLesson(next, sub) ? <Lock /> : <ChevronRight />}
            </Button>
          </div>

          <div className="mt-8">
            <Tabs
              label="Lesson information"
              value={tab}
              onChange={setTab}
              items={[
                { value: "overview", label: "Overview" },
                { value: "resources", label: "Resources" },
              ]}
            />
            {tab === "overview" ? (
              <div className="py-5">
                <p className="leading-relaxed text-slate-600">{lesson.description}</p>
                <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-line bg-white p-3">
                    <dt className="text-xs text-slate-500">Instructor</dt>
                    <dd className="text-sm font-semibold text-ink">{course.instructor.name}</dd>
                  </div>
                  <div className="rounded-xl border border-line bg-white p-3">
                    <dt className="text-xs text-slate-500">Duration</dt>
                    <dd className="text-sm font-semibold text-ink">{formatClock(lesson.durationSec)}</dd>
                  </div>
                  <div className="rounded-xl border border-line bg-white p-3">
                    <dt className="text-xs text-slate-500">Video source</dt>
                    <dd className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                      {lesson.video.kind === "upload" ? <FileVideo className="size-4 text-slate-400" /> : <ExternalLink className="size-4 text-slate-400" />}
                      {lesson.video.kind === "upload" ? "Uploaded file" : "External URL"}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="space-y-3 py-5">
                {["Lesson notes (PDF)", "Practice worksheet (PDF)"].map((r) => (
                  <div key={r} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-lg bg-red-50 text-xs font-bold text-red-600">PDF</span>
                      <div>
                        <p className="text-sm font-semibold text-ink">{r}</p>
                        <p className="text-xs text-slate-500">Downloads aren&apos;t connected in the prototype</p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" disabled title="Not available in the prototype">
                      <Download /> Download
                    </Button>
                  </div>
                ))}
                <SimulatedNote>File storage is out of scope for the UI-first phase.</SimulatedNote>
              </div>
            )}
          </div>
        </div>

        <aside className="hidden border-l border-line bg-white lg:block" aria-label="Course contents">
          <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto">
            <Outline course={course} currentId={lesson.id} learnerId={learner?.id} onPick={go} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Outline({ course, currentId, learnerId, onPick }: { course: Course; currentId: string; learnerId?: string; onPick: (l: Lesson) => void }) {
  const { state, sub } = useSession();
  const currentModule = course.modules.find((m) => m.lessons.some((l) => l.id === currentId))?.id;
  const [closed, setClosed] = useState<string[]>(course.modules.filter((m) => m.id !== currentModule).map((m) => m.id).slice(2));
  const done = new Set(state.progress.filter((p) => p.learnerId === learnerId && p.courseId === course.id && p.completed).map((p) => p.lessonId));

  return (
    <div>
      <div className="border-b border-line px-5 py-4">
        <p className="text-sm font-bold text-ink">Course contents</p>
        <p className="text-xs text-slate-500">
          {course.modules.length} modules · {allLessons(course).length} lessons
        </p>
      </div>
      {course.modules.map((m, mi) => {
        const open = !closed.includes(m.id);
        return (
          <div key={m.id} className="border-b border-line">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setClosed(open ? [...closed, m.id] : closed.filter((x) => x !== m.id))}
              className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
            >
              <span className="text-xs font-bold text-brand-700">{String(mi + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 text-sm font-bold text-ink">{m.title}</span>
              <span className="text-xs text-slate-400">
                {m.lessons.filter((l) => done.has(l.id)).length}/{m.lessons.length}
              </span>
              <ChevronDown className={cn("size-4 text-slate-400 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <ul className="pb-2">
                {m.lessons.map((l) => {
                  const current = l.id === currentId;
                  const can = canWatchLesson(l, sub);
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => onPick(l)}
                        aria-current={current ? "true" : undefined}
                        className={cn(
                          "flex w-full items-start gap-3 border-l-[3px] px-5 py-2.5 text-left transition-colors",
                          current ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-slate-50",
                        )}
                      >
                        <span className={cn("mt-0.5 shrink-0", done.has(l.id) ? "text-emerald-600" : can ? "text-brand-600" : "text-slate-400")}>
                          {done.has(l.id) ? <CircleCheck className="size-4" /> : can ? <CirclePlay className="size-4" /> : <Lock className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm", current ? "font-bold text-brand-800" : "font-medium text-slate-700")}>{l.title}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                            {formatClock(l.durationSec)}
                            {l.isPreview && <span className="font-semibold text-brand-700">Free preview</span>}
                          </span>
                        </span>
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
  );
}
