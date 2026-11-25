"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CirclePlay,
  ExternalLink,
  Eye,
  FileVideo,
  GripVertical,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  TriangleAlert,
  Upload,
  Undo2,
} from "lucide-react";
import { CourseThumb, THEMES } from "@/components/course-visuals";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Callout, Card, CardHeader, EmptyState, ErrorState, PageHeader, ProgressBar, SimulatedNote, Skeleton } from "@/components/ui/feedback";
import { ChipGroup, Field, Input, Segmented, Select, Switch, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { allLessons, courseStats, hasPermission } from "@/lib/access";
import { useSession, useSimulatedLoad } from "@/lib/hooks";
import { EXAMS, SUBJECTS, examShort, subjectName } from "@/lib/mock/catalog";
import { createCourse, deleteCourse, saveCourse, setCourseStatus } from "@/lib/store";
import type { Course, CourseLevel, CourseStatus, ExamId, Lesson, SubjectId, ThumbTheme } from "@/lib/types";
import { cn, formatClock, formatHoursMinutes, moveItem, relativeTime, slugify, uid } from "@/lib/utils";
import { Restricted } from "./admin-shell";

const STATUS_TONE: Record<CourseStatus, Tone> = { published: "green", draft: "amber", archived: "slate" };
const STATUS_LABEL: Record<CourseStatus, string> = { published: "Published", draft: "Draft", archived: "Archived" };

/* ------------------------------ List ------------------------------ */

export function CoursesAdminPage() {
  const { state, admin, now } = useSession();
  const [tab, setTab] = useState<CourseStatus | "all">("all");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "archive" | "delete"; course: Course } | null>(null);
  const load = useSimulatedLoad("admin-courses");

  const activity = (id: string) => state.progress.filter((p) => p.courseId === id).length;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.courses
      .filter((c) => tab === "all" || c.status === tab)
      .filter((c) => !needle || `${c.title} ${c.slug} ${c.instructor.name}`.toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [state.courses, tab, q]);

  if (!admin || !hasPermission(admin, "courses")) return <Restricted what="courses" />;
  const count = (s: CourseStatus | "all") => (s === "all" ? state.courses.length : state.courses.filter((c) => c.status === s).length);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        description="Create and organise courses, modules and lessons. Archive instead of deleting when learners have activity."
        actions={
          <ButtonLink href="/admin/courses/new">
            <Plus /> New course
          </ButtonLink>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            label="Course status"
            variant="pill"
            value={tab}
            onChange={setTab}
            items={[
              { value: "all", label: "All", count: count("all") },
              { value: "published", label: "Published", count: count("published") },
              { value: "draft", label: "Draft", count: count("draft") },
              { value: "archived", label: "Archived", count: count("archived") },
            ]}
          />
          <label className="relative lg:w-72">
            <span className="sr-only">Search courses</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses" className="h-10 w-full rounded-lg border border-line-strong pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:shadow-ring" />
          </label>
        </div>

        {load.status === "loading" ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : load.status === "error" ? (
          <div className="p-4">
            <ErrorState onRetry={load.retry} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState className="border-0" icon={<BookOpen />} title="No courses here" description="Create a course or change the filter." action={<ButtonLink href="/admin/courses/new">New course</ButtonLink>} />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((c) => {
              const s = courseStats(c);
              const act = activity(c.id);
              return (
                <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link href={`/admin/courses/${c.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <CourseThumb theme={c.theme} subjectIds={c.subjectIds} size="sm" className="h-14 w-20 shrink-0 rounded-lg" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-fg hover:text-brand-700 dark:hover:text-brand-300">{c.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span>{c.subjectIds.map(subjectName).join(", ")}</span>·<span>{c.examIds.map(examShort).join(", ") || "No exam"}</span>·
                        <span>
                          {s.moduleCount} modules, {s.lessonCount} lessons
                        </span>
                        {!s.preview && (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                            <TriangleAlert className="size-3" /> no preview
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3 sm:gap-5">
                    <div className="hidden text-right text-xs text-slate-500 md:block">
                      <p>{act} learner progress records</p>
                      <p>Updated {relativeTime(c.updatedAt, now)}</p>
                    </div>
                    <Badge tone={STATUS_TONE[c.status]} dot>
                      {STATUS_LABEL[c.status]}
                    </Badge>
                    <ButtonLink href={`/admin/courses/${c.id}`} size="sm" variant="secondary">
                      <Pencil /> Edit
                    </ButtonLink>
                    <Menu
                      label={`Actions for ${c.title}`}
                      trigger={(p) => (
                        <IconButton label="More actions" size="sm" onClick={p.toggle} aria-expanded={p["aria-expanded"]} aria-haspopup="menu">
                          <MoreHorizontal />
                        </IconButton>
                      )}
                    >
                      {(close) => (
                        <>
                          {c.status !== "archived" && (
                            <MenuItem
                              icon={<Eye />}
                              onSelect={() => {
                                close();
                                setCourseStatus(c.id, c.status === "published" ? "draft" : "published", admin.id);
                                toast({ title: c.status === "published" ? "Moved to draft" : "Course published", simulated: true });
                              }}
                            >
                              {c.status === "published" ? "Unpublish (to draft)" : "Publish"}
                            </MenuItem>
                          )}
                          {c.status === "published" && (
                            <MenuItem icon={<ExternalLink />} onSelect={() => { close(); window.open(`/courses/${c.slug}`, "_blank"); }}>
                              View in catalog
                            </MenuItem>
                          )}
                          {c.status === "archived" ? (
                            <MenuItem
                              icon={<ArchiveRestore />}
                              onSelect={() => {
                                close();
                                setCourseStatus(c.id, "draft", admin.id);
                                toast({ title: "Course restored as draft", simulated: true });
                              }}
                            >
                              Restore as draft
                            </MenuItem>
                          ) : (
                            <MenuItem icon={<Archive />} onSelect={() => { close(); setConfirm({ kind: "archive", course: c }); }}>
                              Archive
                            </MenuItem>
                          )}
                          <div className="my-1 border-t border-line" />
                          <MenuItem danger icon={<Trash2 />} onSelect={() => { close(); setConfirm({ kind: "delete", course: c }); }}>
                            Delete
                          </MenuItem>
                        </>
                      )}
                    </Menu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirm?.kind === "archive"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) setCourseStatus(confirm.course.id, "archived", admin.id);
          toast({ title: "Course archived", description: "Removed from the catalog. Learner progress is preserved.", simulated: true });
          setConfirm(null);
        }}
        title={`Archive “${confirm?.course.title}”?`}
        description="It will be removed from the public catalog. Learner progress and history are kept, and you can restore it later."
        confirmLabel="Archive course"
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) deleteCourse(confirm.course.id, admin.id);
          toast({ title: "Course deleted", simulated: true });
          setConfirm(null);
        }}
        tone="danger"
        title={`Delete “${confirm?.course.title}”?`}
        description={confirm && activity(confirm.course.id) > 0 ? undefined : "This permanently removes the course and its lessons."}
        confirmLabel="Delete permanently"
        confirmDisabled={!!confirm && activity(confirm.course.id) > 0}
      >
        {confirm && activity(confirm.course.id) > 0 && (
          <Callout tone="warning" title="This course has learner activity">
            {activity(confirm.course.id)} progress records reference this course. Archive it instead to preserve learner history.
          </Callout>
        )}
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------ Create ------------------------------ */

export function CourseCreatePage() {
  const router = useRouter();
  const { state, admin } = useSession();
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    subjectIds: [] as SubjectId[],
    examIds: [] as ExamId[],
    level: "Intermediate" as CourseLevel,
    instructorName: "",
    instructorTitle: "",
    theme: "teal" as ThumbTheme,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!admin || !hasPermission(admin, "courses")) return <Restricted what="courses" />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.title.trim().length < 5) errs.title = "Title must be at least 5 characters";
    else if (state.courses.some((c) => c.slug === slugify(form.title))) errs.title = "A course with a similar title already exists";
    if (!form.subtitle.trim()) errs.subtitle = "Add a one-line summary";
    if (!form.subjectIds.length) errs.subjects = "Choose at least one subject";
    if (!form.instructorName.trim()) errs.instructor = "Add the instructor's name";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const id = createCourse(
      {
        slug: slugify(form.title),
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        description: "",
        theme: form.theme,
        subjectIds: form.subjectIds,
        examIds: form.examIds,
        level: form.level,
        instructor: { name: form.instructorName.trim(), title: form.instructorTitle.trim() || "Faculty" },
        status: "draft",
        featured: false,
        highlights: [],
        modules: [{ id: uid("m"), title: "Module 1", lessons: [] }],
        rating: 0,
        ratingCount: 0,
        enrolled: 0,
      },
      admin.id,
    );
    toast({ title: "Draft course created", description: "Now add modules and lessons.", simulated: true });
    router.push(`/admin/courses/${id}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/courses" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-fg">
        <ArrowLeft className="size-4" /> Courses
      </Link>
      <PageHeader title="New course" description="Start with the basics. The course is saved as a draft and stays hidden until you publish it." />
      <Card>
        <form onSubmit={submit} noValidate className="space-y-5 p-5 sm:p-6">
          <Field label="Course title" error={errors.title} required hint={form.title ? `URL: /courses/${slugify(form.title)}` : undefined}>
            {(p) => <Input {...p} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Rotational Mechanics for JEE" />}
          </Field>
          <Field label="Subtitle" error={errors.subtitle} required>
            {(p) => <Input {...p} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="One line that sells the course" />}
          </Field>
          <ChipGroup label="Subjects" value={form.subjectIds} onChange={(v) => setForm({ ...form, subjectIds: v })} options={SUBJECTS.map((s) => ({ value: s.id, label: s.name }))} error={errors.subjects} />
          <ChipGroup label="Exam categories (optional)" value={form.examIds} onChange={(v) => setForm({ ...form, examIds: v })} options={EXAMS.map((e) => ({ value: e.id, label: e.comingSoon ? `${e.name} (planned)` : e.name }))} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Level">
              {(p) => (
                <Select {...p} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as CourseLevel })}>
                  <option>Foundation</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </Select>
              )}
            </Field>
            <Field label="Instructor name" error={errors.instructor} required>
              {(p) => <Input {...p} value={form.instructorName} onChange={(e) => setForm({ ...form, instructorName: e.target.value })} />}
            </Field>
            <Field label="Instructor title">
              {(p) => <Input {...p} value={form.instructorTitle} onChange={(e) => setForm({ ...form, instructorTitle: e.target.value })} placeholder="e.g. Physics faculty" />}
            </Field>
          </div>
          <ThemePicker value={form.theme} onChange={(t) => setForm({ ...form, theme: t })} subjects={form.subjectIds} />
          <div className="flex justify-end gap-2 border-t border-line pt-5">
            <ButtonLink href="/admin/courses" variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit">Create draft</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function ThemePicker({ value, onChange, subjects }: { value: ThumbTheme; onChange: (t: ThumbTheme) => void; subjects: SubjectId[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-fg">Thumbnail style</legend>
      <div className="flex flex-wrap items-center gap-3">
        {(Object.keys(THEMES) as ThumbTheme[]).map((t) => (
          <button key={t} type="button" onClick={() => onChange(t)} aria-pressed={value === t} aria-label={`${THEMES[t].label} theme`} className={cn("rounded-xl p-0.5 ring-2 transition", value === t ? "ring-brand-500" : "ring-transparent hover:ring-slate-200")}>
            <CourseThumb theme={t} subjectIds={subjects.length ? subjects : ["physics"]} size="sm" className="h-12 w-16 rounded-lg" />
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">Image upload isn&apos;t connected in the prototype, so courses use illustrated thumbnails.</p>
    </fieldset>
  );
}

/* ------------------------------ Editor ------------------------------ */

export function CourseEditorPage({ courseId }: { courseId: string }) {
  const { state, admin } = useSession();
  if (!admin || !hasPermission(admin, "courses")) return <Restricted what="courses" />;
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) return <EmptyState icon={<BookOpen />} title="Course not found" action={<ButtonLink href="/admin/courses">Back to courses</ButtonLink>} />;
  return <CourseEditor key={`${course.id}:${course.updatedAt}`} course={course} adminId={admin.id} />;
}

function publishIssues(c: Course): string[] {
  const issues: string[] = [];
  const lessons = allLessons(c);
  if (c.title.trim().length < 5) issues.push("Title must be at least 5 characters.");
  if (!c.subjectIds.length) issues.push("Choose at least one subject.");
  if (!lessons.length) issues.push("Add at least one lesson.");
  if (c.modules.some((m) => !m.title.trim())) issues.push("Every module needs a title.");
  if (c.modules.some((m) => m.lessons.length === 0)) issues.push("Remove or fill empty modules.");
  const previews = lessons.filter((l) => l.isPreview).length;
  if (previews !== 1) issues.push("Mark exactly one lesson as the free preview.");
  return issues;
}

function CourseEditor({ course, adminId }: { course: Course; adminId: string }) {
  const { state } = useSession();
  const hasLessons = allLessons(course).length > 0;
  const [tab, setTab] = useState<"details" | "curriculum">(hasLessons ? "details" : "curriculum");
  const [draft, setDraft] = useState<Course>(course);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(course);
  const stats = courseStats(draft);

  const validateDetails = () => {
    const errs: Record<string, string> = {};
    if (draft.title.trim().length < 5) errs.title = "At least 5 characters";
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug)) errs.slug = "Use lowercase letters, numbers and hyphens";
    else if (state.courses.some((c) => c.slug === draft.slug && c.id !== draft.id)) errs.slug = "Another course uses this URL";
    if (!draft.subtitle.trim()) errs.subtitle = "Required";
    setErrors(errs);
    if (Object.keys(errs).length) setTab("details");
    return Object.keys(errs).length === 0;
  };

  const save = (status?: CourseStatus) => {
    if (!validateDetails()) return;
    const next = { ...draft, status: status ?? draft.status };
    if (status === "published") {
      const problems = publishIssues(next);
      setIssues(problems);
      if (problems.length) {
        toast({ title: "Can't publish yet", description: `${problems.length} issue${problems.length > 1 ? "s" : ""} to fix.`, tone: "error" });
        return;
      }
    }
    saveCourse(next, adminId);
    toast({ title: status === "published" ? "Course published" : status === "draft" ? "Moved to draft" : "Changes saved", simulated: true });
  };

  return (
    <div className="space-y-6 pb-24">
      <Link href="/admin/courses" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-fg">
        <ArrowLeft className="size-4" /> Courses
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <CourseThumb theme={draft.theme} subjectIds={draft.subjectIds.length ? draft.subjectIds : ["physics"]} size="sm" className="h-16 w-24 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-extrabold">{draft.title || "Untitled course"}</h1>
              <Badge tone={STATUS_TONE[course.status]} dot>
                {STATUS_LABEL[course.status]}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              {stats.moduleCount} modules · {stats.lessonCount} lessons · {formatHoursMinutes(stats.totalSec)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status === "published" && (
            <ButtonLink href={`/courses/${course.slug}`} target="_blank" variant="secondary">
              <ExternalLink /> View live
            </ButtonLink>
          )}
          {course.status !== "archived" && (
            <Button variant="secondary" onClick={() => setArchiveOpen(true)}>
              <Archive /> Archive
            </Button>
          )}
          {course.status === "archived" ? (
            <Button variant="secondary" onClick={() => save("draft")}>
              <ArchiveRestore /> Restore as draft
            </Button>
          ) : course.status === "published" ? (
            <Button variant="secondary" onClick={() => save("draft")}>
              Unpublish
            </Button>
          ) : (
            <Button onClick={() => save("published")}>
              <Eye /> {dirty ? "Save & publish" : "Publish"}
            </Button>
          )}
        </div>
      </div>

      {course.status === "archived" && (
        <Callout tone="info" title="This course is archived">
          It&apos;s hidden from the catalog. Learner progress is preserved. Restore it as a draft to make changes and republish.
        </Callout>
      )}
      {issues.length > 0 && (
        <Callout tone="danger" title="Fix these before publishing">
          <ul className="mt-1 list-disc pl-4">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Callout>
      )}

      <Tabs
        label="Course editor"
        value={tab}
        onChange={setTab}
        items={[
          { value: "details", label: "Details" },
          { value: "curriculum", label: "Curriculum", count: stats.lessonCount },
        ]}
      />

      {tab === "details" ? (
        <DetailsForm draft={draft} setDraft={setDraft} errors={errors} />
      ) : (
        <CurriculumEditor draft={draft} setDraft={setDraft} />
      )}

      {/* Sticky save bar */}
      <div className={cn("fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur transition-transform lg:left-64", dirty ? "translate-y-0" : "invisible translate-y-full")} aria-hidden={!dirty}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-fg">
            <span className="size-2 rounded-full bg-amber-500" /> Unsaved changes
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setDraft(course); setErrors({}); setIssues([]); }} tabIndex={dirty ? 0 : -1}>
              <Undo2 /> Discard
            </Button>
            <Button onClick={() => save()} tabIndex={dirty ? 0 : -1}>
              <Save /> Save changes
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => {
          setCourseStatus(course.id, "archived", adminId);
          setArchiveOpen(false);
          toast({ title: "Course archived", description: "Learner progress is preserved.", simulated: true });
        }}
        title="Archive this course?"
        description="It will be removed from the active catalog. Learner progress and history are retained. Unsaved edits will be discarded."
        confirmLabel="Archive"
      />
    </div>
  );
}

function DetailsForm({ draft, setDraft, errors }: { draft: Course; setDraft: (c: Course) => void; errors: Record<string, string> }) {
  const [highlight, setHighlight] = useState("");
  const set = <K extends keyof Course>(k: K, v: Course[K]) => setDraft({ ...draft, [k]: v });
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="Course information" />
        <div className="space-y-5 p-5">
          <Field label="Title" error={errors.title} required>
            {(p) => <Input {...p} value={draft.title} onChange={(e) => set("title", e.target.value)} />}
          </Field>
          <Field label="URL slug" error={errors.slug} required hint={`/courses/${draft.slug}`}>
            {(p) => <Input {...p} value={draft.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className="font-mono" />}
          </Field>
          <Field label="Subtitle" error={errors.subtitle} required>
            {(p) => <Input {...p} value={draft.subtitle} onChange={(e) => set("subtitle", e.target.value)} />}
          </Field>
          <Field label="Description" hint="Shown on the course page under “About this course”.">
            {(p) => <Textarea {...p} rows={5} value={draft.description} onChange={(e) => set("description", e.target.value)} />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Instructor name">
              {(p) => <Input {...p} value={draft.instructor.name} onChange={(e) => set("instructor", { ...draft.instructor, name: e.target.value })} />}
            </Field>
            <Field label="Instructor title">
              {(p) => <Input {...p} value={draft.instructor.title} onChange={(e) => set("instructor", { ...draft.instructor, title: e.target.value })} />}
            </Field>
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">What learners will learn</p>
            <ul className="mt-2 space-y-2">
              {draft.highlights.map((h, i) => (
                <li key={`${h}-${i}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <span className="flex-1">{h}</span>
                  <IconButton label={`Remove “${h}”`} size="sm" onClick={() => set("highlights", draft.highlights.filter((_, x) => x !== i))}>
                    <Trash2 />
                  </IconButton>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input
                value={highlight}
                onChange={(e) => setHighlight(e.target.value)}
                placeholder="Add a highlight"
                aria-label="New highlight"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && highlight.trim()) {
                    e.preventDefault();
                    set("highlights", [...draft.highlights, highlight.trim()]);
                    setHighlight("");
                  }
                }}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!highlight.trim()) return;
                  set("highlights", [...draft.highlights, highlight.trim()]);
                  setHighlight("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Classification" description="Flexible — a course can map to several exams." />
          <div className="space-y-5 p-5">
            <ChipGroup label="Subjects" value={draft.subjectIds} onChange={(v) => set("subjectIds", v)} options={SUBJECTS.map((s) => ({ value: s.id, label: s.name }))} />
            <ChipGroup label="Exam categories" value={draft.examIds} onChange={(v) => set("examIds", v)} options={EXAMS.map((e) => ({ value: e.id, label: e.short }))} />
            <Field label="Level">
              {(p) => (
                <Select {...p} value={draft.level} onChange={(e) => set("level", e.target.value as CourseLevel)}>
                  <option>Foundation</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </Select>
              )}
            </Field>
            <Switch checked={draft.featured} onChange={(v) => set("featured", v)} label="Feature on homepage" description="Shows in “Popular courses”." />
          </div>
        </Card>
        <Card className="p-5">
          <ThemePicker value={draft.theme} onChange={(t) => set("theme", t)} subjects={draft.subjectIds} />
        </Card>
      </div>
    </div>
  );
}

function CurriculumEditor({ draft, setDraft }: { draft: Course; setDraft: (c: Course) => void }) {
  const [editing, setEditing] = useState<{ moduleId: string; lesson?: Lesson } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "module" | "lesson"; moduleId: string; lessonId?: string } | null>(null);
  const preview = allLessons(draft).find((l) => l.isPreview);

  const updateModules = (modules: Course["modules"]) => setDraft({ ...draft, modules });

  const upsertLesson = (moduleId: string, lesson: Lesson) => {
    const modules = draft.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => (lesson.isPreview && l.id !== lesson.id ? { ...l, isPreview: false } : l)),
    }));
    updateModules(
      modules.map((m) => {
        if (m.id !== moduleId) return m;
        const exists = m.lessons.some((l) => l.id === lesson.id);
        return { ...m, lessons: exists ? m.lessons.map((l) => (l.id === lesson.id ? lesson : l)) : [...m.lessons, lesson] };
      }),
    );
  };

  return (
    <div className="space-y-4">
      <Callout tone={preview ? "brand" : "warning"} icon={<CirclePlay />} title={preview ? `Free preview: “${preview.title}”` : "No free preview lesson"}>
        Each course has exactly one free preview lesson, watchable by visitors and non-subscribers. Marking another lesson as preview replaces the current one.
      </Callout>

      {draft.modules.map((m, mi) => (
        <Card key={m.id}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-100 dark:bg-brand-400/15 text-sm font-extrabold text-brand-700 dark:text-brand-300">{mi + 1}</span>
            <input
              value={m.title}
              onChange={(e) => updateModules(draft.modules.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))}
              aria-label={`Module ${mi + 1} title`}
              placeholder="Module title"
              className={cn("min-w-0 flex-1 rounded-md border border-transparent px-2 py-1.5 text-base font-bold text-fg outline-none hover:border-line focus:border-brand-500 focus:shadow-ring", !m.title.trim() && "border-red-300 dark:border-red-500/40")}
            />
            <div className="flex items-center gap-0.5">
              <IconButton label="Move module up" size="sm" disabled={mi === 0} onClick={() => updateModules(moveItem(draft.modules, mi, mi - 1))}>
                <ArrowUp />
              </IconButton>
              <IconButton label="Move module down" size="sm" disabled={mi === draft.modules.length - 1} onClick={() => updateModules(moveItem(draft.modules, mi, mi + 1))}>
                <ArrowDown />
              </IconButton>
              <IconButton
                label="Delete module"
                size="sm"
                className="hover:text-red-600 dark:hover:text-red-400"
                onClick={() => (m.lessons.length ? setConfirmDelete({ type: "module", moduleId: m.id }) : updateModules(draft.modules.filter((x) => x.id !== m.id)))}
              >
                <Trash2 />
              </IconButton>
            </div>
          </div>
          {m.lessons.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">No lessons in this module yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {m.lessons.map((l, li) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                  <GripVertical className="size-4 shrink-0 text-slate-300" aria-hidden />
                  <span className="w-6 shrink-0 text-xs font-bold text-slate-400">{li + 1}</span>
                  {l.video.kind === "upload" ? <FileVideo className="size-4 shrink-0 text-slate-400" aria-label="Uploaded video" /> : <Link2 className="size-4 shrink-0 text-slate-400" aria-label="External URL" />}
                  <button type="button" onClick={() => setEditing({ moduleId: m.id, lesson: l })} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-fg hover:text-brand-700 dark:hover:text-brand-300">
                    {l.title}
                  </button>
                  {l.isPreview && <Badge tone="brand" size="xs">Preview</Badge>}
                  <span className="hidden font-mono text-xs text-slate-500 sm:inline">{formatClock(l.durationSec)}</span>
                  <div className="flex items-center">
                    <IconButton label="Move lesson up" size="sm" disabled={li === 0} onClick={() => updateModules(draft.modules.map((x) => (x.id === m.id ? { ...x, lessons: moveItem(x.lessons, li, li - 1) } : x)))}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label="Move lesson down" size="sm" disabled={li === m.lessons.length - 1} onClick={() => updateModules(draft.modules.map((x) => (x.id === m.id ? { ...x, lessons: moveItem(x.lessons, li, li + 1) } : x)))}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton label="Edit lesson" size="sm" onClick={() => setEditing({ moduleId: m.id, lesson: l })}>
                      <Pencil />
                    </IconButton>
                    <IconButton label="Delete lesson" size="sm" className="hover:text-red-600 dark:hover:text-red-400" onClick={() => setConfirmDelete({ type: "lesson", moduleId: m.id, lessonId: l.id })}>
                      <Trash2 />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line px-4 py-2.5">
            <Button variant="ghost" size="sm" onClick={() => setEditing({ moduleId: m.id })}>
              <Plus /> Add lesson
            </Button>
          </div>
        </Card>
      ))}

      <Button variant="outline" onClick={() => updateModules([...draft.modules, { id: uid("m"), title: `Module ${draft.modules.length + 1}`, lessons: [] }])}>
        <Plus /> Add module
      </Button>

      <LessonDialog
        key={editing ? `${editing.moduleId}:${editing.lesson?.id ?? "new"}` : "closed"}
        open={!!editing}
        lesson={editing?.lesson}
        currentPreview={preview}
        onClose={() => setEditing(null)}
        onSave={(lesson) => {
          if (editing) upsertLesson(editing.moduleId, lesson);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        tone="danger"
        title={confirmDelete?.type === "module" ? "Delete module and its lessons?" : "Delete lesson?"}
        description="This change applies when you save the course. Learner progress records for removed lessons are kept for history."
        confirmLabel="Delete"
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === "module") updateModules(draft.modules.filter((x) => x.id !== confirmDelete.moduleId));
          else updateModules(draft.modules.map((x) => (x.id === confirmDelete.moduleId ? { ...x, lessons: x.lessons.filter((l) => l.id !== confirmDelete.lessonId) } : x)));
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function LessonDialog({
  open,
  lesson,
  currentPreview,
  onClose,
  onSave,
}: {
  open: boolean;
  lesson?: Lesson;
  currentPreview?: Lesson;
  onClose: () => void;
  onSave: (l: Lesson) => void;
}) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [mins, setMins] = useState(String(Math.floor((lesson?.durationSec ?? 0) / 60)));
  const [secs, setSecs] = useState(String((lesson?.durationSec ?? 0) % 60));
  const [kind, setKind] = useState<"upload" | "url">(lesson?.video.kind ?? "upload");
  const [fileName, setFileName] = useState(lesson?.video.kind === "upload" ? lesson.video.ref : "");
  const [url, setUrl] = useState(lesson?.video.kind === "url" ? lesson.video.ref : "");
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [isPreview, setIsPreview] = useState(lesson?.isPreview ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pct = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const startUpload = (name: string) => {
    setFileName(name);
    setUploadPct(0);
    pct.current = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      pct.current = Math.min(100, pct.current + 12);
      setUploadPct(pct.current);
      if (pct.current >= 100 && timer.current) clearInterval(timer.current);
    }, 160);
  };

  const save = () => {
    const errs: Record<string, string> = {};
    const duration = Number(mins) * 60 + Number(secs);
    if (title.trim().length < 3) errs.title = "Enter a lesson title";
    if (!Number.isFinite(duration) || duration <= 0) errs.duration = "Enter a duration";
    if (kind === "upload" && !fileName) errs.video = "Choose a video file";
    if (kind === "upload" && uploadPct !== null && uploadPct < 100) errs.video = "Wait for the upload to finish";
    if (kind === "url" && !/^https:\/\/\S+\.\S+/.test(url.trim())) errs.video = "Enter a valid https:// URL";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      id: lesson?.id ?? uid("l"),
      title: title.trim(),
      description: description.trim(),
      durationSec: duration,
      isPreview,
      video: kind === "upload" ? { kind, ref: fileName } : { kind, ref: url.trim() },
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={lesson ? "Edit lesson" : "Add lesson"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{lesson ? "Update lesson" : "Add lesson"}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Lesson title" error={errors.title} required>
          {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Projectile motion" />}
        </Field>
        <Field label="Description">
          {(p) => <Textarea {...p} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold text-fg">
            Duration <span className="text-red-500">*</span>
          </legend>
          <div className="mt-1.5 flex items-center gap-2">
            <Input aria-label="Minutes" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value.replace(/\D/g, ""))} className="w-20" />
            <span className="text-sm text-slate-500">min</span>
            <Input aria-label="Seconds" inputMode="numeric" value={secs} onChange={(e) => setSecs(e.target.value.replace(/\D/g, "").slice(0, 2))} className="w-20" />
            <span className="text-sm text-slate-500">sec</span>
          </div>
          {errors.duration && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.duration}</p>}
        </fieldset>
        <div>
          <p className="mb-2 text-sm font-semibold text-fg">Video source</p>
          <Segmented
            label="Video source"
            value={kind}
            onChange={setKind}
            options={[
              { value: "upload", label: <span className="inline-flex items-center gap-1.5"><Upload className="size-4" /> Upload file</span> },
              { value: "url", label: <span className="inline-flex items-center gap-1.5"><Link2 className="size-4" /> External URL</span> },
            ]}
          />
          <div className="mt-3">
            {kind === "upload" ? (
              <div className="rounded-xl border-2 border-dashed border-line-strong p-4">
                <input id="video-file" type="file" accept="video/*" className="sr-only" onChange={(e) => e.target.files?.[0] && startUpload(e.target.files[0].name)} />
                {fileName ? (
                  <div className="flex items-center gap-3">
                    <FileVideo className="size-6 text-brand-600 dark:text-brand-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">{fileName}</p>
                      {uploadPct !== null && uploadPct < 100 ? (
                        <ProgressBar value={uploadPct} size="sm" className="mt-1.5" label="Upload progress" />
                      ) : (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">Ready (simulated upload)</p>
                      )}
                    </div>
                    <label htmlFor="video-file" className="cursor-pointer text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">
                      Replace
                    </label>
                  </div>
                ) : (
                  <label htmlFor="video-file" className="flex cursor-pointer flex-col items-center gap-1 text-center">
                    <Upload className="size-6 text-slate-400" />
                    <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">Choose a video file</span>
                    <span className="text-xs text-slate-500">MP4 or MOV</span>
                  </label>
                )}
              </div>
            ) : (
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://videos.example.com/lesson" aria-label="Video URL" />
            )}
            {errors.video && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.video}</p>}
            <SimulatedNote className="mt-2">No real upload, transcoding or streaming happens in the UI-first phase.</SimulatedNote>
          </div>
        </div>
        <div className="rounded-xl border border-line p-4">
          <Switch checked={isPreview} onChange={setIsPreview} label="Free preview lesson" description="Visible to visitors and learners without a subscription." />
          {isPreview && currentPreview && currentPreview.id !== lesson?.id && (
            <p className="mt-3 flex items-start gap-2 text-xs font-medium text-amber-800 dark:text-amber-200">
              <TriangleAlert className="mt-px size-3.5 shrink-0" /> This replaces “{currentPreview.title}” as the course&apos;s free preview.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
