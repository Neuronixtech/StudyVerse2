"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ClipboardList,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Gift,
  History,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Callout, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/feedback";
import { ChipGroup, Field, Input, Segmented, Select, Switch, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { hasPermission } from "@/lib/access";
import { describeMultiRule, marksFor, maxScoreOf, questionCount, QUESTION_TYPE_LABEL, QUESTION_TYPE_SHORT, totalDurationMin } from "@/lib/exam";
import { useSession, useSimulatedLoad } from "@/lib/hooks";
import { EXAMS, SUBJECTS, examShort, subjectName } from "@/lib/mock/catalog";
import { createTest, deleteTest, saveTest, setDemoTest, setSolutionsReleased, setTestPublished } from "@/lib/store";
import type { ExamId, Marks, MultiMarkingRule, Question, QuestionType, SubjectId, Test, TestKind, TestSection } from "@/lib/types";
import { cn, moveItem, relativeTime, slugify, uid } from "@/lib/utils";
import { Restricted } from "./admin-shell";

const KIND_LABEL: Record<TestKind, string> = { full: "Full mock", sectional: "Sectional", chapter: "Chapter test", practice: "Practice" };

/* ------------------------------ List ------------------------------ */

export function TestsAdminPage() {
  const { state, admin, now } = useSession();
  const [tab, setTab] = useState<"all" | "published" | "unpublished">("all");
  const [q, setQ] = useState("");
  const [demoConfirm, setDemoConfirm] = useState<Test | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Test | null>(null);
  const load = useSimulatedLoad("admin-tests");
  const attemptsOf = (id: string) => state.attempts.filter((a) => a.testId === id).length;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.tests
      .filter((t) => (tab === "all" ? true : tab === "published" ? t.published : !t.published))
      .filter((t) => !needle || t.title.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.isDemo) - Number(a.isDemo) || b.updatedAt - a.updatedAt);
  }, [state.tests, tab, q]);

  if (!admin || !hasPermission(admin, "tests")) return <Restricted what="tests" />;
  const currentDemo = state.tests.find((t) => t.isDemo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests"
        description="Build tests, configure timing and marking, and choose the one free demo test."
        actions={
          <ButtonLink href="/admin/tests/new">
            <Plus /> New test
          </ButtonLink>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            label="Publication"
            variant="pill"
            value={tab}
            onChange={setTab}
            items={[
              { value: "all", label: "All", count: state.tests.length },
              { value: "published", label: "Published", count: state.tests.filter((t) => t.published).length },
              { value: "unpublished", label: "Unpublished", count: state.tests.filter((t) => !t.published).length },
            ]}
          />
          <label className="relative lg:w-72">
            <span className="sr-only">Search tests</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tests" className="h-10 w-full rounded-lg border border-line-strong pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:shadow-ring" />
          </label>
        </div>
        {load.status === "loading" ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : load.status === "error" ? (
          <div className="p-4">
            <ErrorState onRetry={load.retry} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState className="border-0" icon={<ClipboardList />} title="No tests found" action={<ButtonLink href="/admin/tests/new">New test</ButtonLink>} />
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Test</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Classification</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Structure</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Attempts</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const attempts = attemptsOf(t.id);
                  return (
                    <tr key={t.id} className="border-t border-line hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <Link href={`/admin/tests/${t.id}`} className="font-semibold text-fg hover:text-brand-700 dark:hover:text-brand-300">
                          {t.title}
                        </Link>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                          {KIND_LABEL[t.kind]} · v{t.version} · updated {relativeTime(t.updatedAt, now)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {t.examId ? examShort(t.examId) : "Standalone"}
                        <span className="block text-slate-400">{t.subjectIds.map(subjectName).join(", ")}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {t.sections.length} section{t.sections.length > 1 ? "s" : ""} · {questionCount(t)} Q
                        <span className="block text-slate-400">
                          {totalDurationMin(t)} min · {t.timingMode === "sectional" ? "section timers" : "overall timer"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{attempts}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={t.published ? "green" : "slate"} dot>
                            {t.published ? "Published" : "Unpublished"}
                          </Badge>
                          {t.isDemo && (
                            <Badge tone="brand">
                              <Gift /> Demo
                            </Badge>
                          )}
                          {t.resultRelease === "manual" && (
                            <Badge tone={t.solutionsReleased ? "sky" : "amber"} size="xs">
                              {t.solutionsReleased ? "Solutions out" : "Solutions held"}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <ButtonLink href={`/admin/tests/${t.id}`} size="sm" variant="secondary">
                            <Pencil /> Edit
                          </ButtonLink>
                          <Menu
                            label={`Actions for ${t.title}`}
                            trigger={(p) => (
                              <IconButton label="More actions" size="sm" onClick={p.toggle} aria-expanded={p["aria-expanded"]} aria-haspopup="menu">
                                <MoreHorizontal />
                              </IconButton>
                            )}
                          >
                            {(close) => (
                              <>
                                {!t.isDemo && (
                                  <MenuItem
                                    icon={t.published ? <EyeOff /> : <Eye />}
                                    onSelect={() => {
                                      close();
                                      setTestPublished(t.id, !t.published, admin.id);
                                      toast({ title: t.published ? "Test unpublished" : "Test published", simulated: true });
                                    }}
                                  >
                                    {t.published ? "Unpublish" : "Publish"}
                                  </MenuItem>
                                )}
                                {!t.isDemo && (
                                  <MenuItem icon={<Star />} onSelect={() => { close(); setDemoConfirm(t); }}>
                                    Set as free demo
                                  </MenuItem>
                                )}
                                {t.resultRelease === "manual" && (
                                  <MenuItem
                                    icon={t.solutionsReleased ? <Lock /> : <LockOpen />}
                                    onSelect={() => {
                                      close();
                                      setSolutionsReleased(t.id, !t.solutionsReleased, admin.id);
                                      toast({ title: t.solutionsReleased ? "Solutions withheld" : "Solutions released to learners", simulated: true });
                                    }}
                                  >
                                    {t.solutionsReleased ? "Withhold solutions" : "Release solutions"}
                                  </MenuItem>
                                )}
                                {t.published && (
                                  <MenuItem icon={<ExternalLink />} onSelect={() => { close(); window.open(`/tests/${t.id}`, "_blank"); }}>
                                    View learner page
                                  </MenuItem>
                                )}
                                <div className="my-1 border-t border-line" />
                                <MenuItem danger icon={<Trash2 />} onSelect={() => { close(); setDeleteConfirm(t); }}>
                                  Delete
                                </MenuItem>
                              </>
                            )}
                          </Menu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!demoConfirm}
        onClose={() => setDemoConfirm(null)}
        onConfirm={() => {
          if (demoConfirm) setDemoTest(demoConfirm.id, admin.id);
          toast({ title: "Free demo test updated", description: demoConfirm?.title, simulated: true });
          setDemoConfirm(null);
        }}
        title="Change the free demo test?"
        description={`There is exactly one public demo test. “${demoConfirm?.title}” will become the demo (and be published)${currentDemo ? `, replacing “${currentDemo.title}”, which will then require a subscription` : ""}.`}
        confirmLabel="Set as demo"
      />
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteTest(deleteConfirm.id, admin.id);
          toast({ title: "Test deleted", simulated: true });
          setDeleteConfirm(null);
        }}
        tone="danger"
        title={`Delete “${deleteConfirm?.title}”?`}
        description={deleteConfirm && (attemptsOf(deleteConfirm.id) > 0 || deleteConfirm.isDemo) ? undefined : "This permanently removes the test and its questions."}
        confirmLabel="Delete"
        confirmDisabled={!!deleteConfirm && (attemptsOf(deleteConfirm.id) > 0 || deleteConfirm.isDemo)}
      >
        {deleteConfirm?.isDemo ? (
          <Callout tone="warning">Choose another demo test before deleting this one.</Callout>
        ) : deleteConfirm && attemptsOf(deleteConfirm.id) > 0 ? (
          <Callout tone="warning" title="This test has submitted attempts">
            {attemptsOf(deleteConfirm.id)} learner attempts reference it. Unpublish it instead so historical results stay intact.
          </Callout>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------ Create ------------------------------ */

export function TestCreatePage() {
  const router = useRouter();
  const { admin } = useSession();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TestKind>("chapter");
  const [examId, setExamId] = useState<ExamId | "">("jee-main");
  const [subjectIds, setSubjectIds] = useState<SubjectId[]>([]);
  const [timingMode, setTimingMode] = useState<"overall" | "sectional">("overall");
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!admin || !hasPermission(admin, "tests")) return <Restricted what="tests" />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (title.trim().length < 5) errs.title = "Title must be at least 5 characters";
    if (!subjectIds.length) errs.subjects = "Choose at least one subject";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const sections: TestSection[] = (subjectIds.length > 1 ? subjectIds : [subjectIds[0]]).map((s) => ({ id: uid("s"), name: subjectName(s), subjectId: s, durationMin: 20, questions: [] }));
    const id = createTest(
      {
        slug: slugify(title),
        title: title.trim(),
        description: "",
        kind,
        examId: examId || undefined,
        subjectIds,
        isDemo: false,
        published: false,
        timingMode,
        durationMin: 30,
        sections,
        defaultMarks: examId === "mht-cet" ? { correct: 2, incorrect: 0, unattempted: 0 } : { correct: 4, incorrect: -1, unattempted: 0 },
        multiMarking: examId === "jee-advanced" ? "partial" : "all-or-nothing",
        attemptLimit: null,
        resultRelease: "immediate",
        solutionsReleased: true,
      },
      admin.id,
    );
    toast({ title: "Test created", description: "Add questions, then publish.", simulated: true });
    router.push(`/admin/tests/${id}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/tests" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-fg">
        <ArrowLeft className="size-4" /> Tests
      </Link>
      <PageHeader title="New test" description="Tests start unpublished. You'll add sections and questions next." />
      <Card>
        <form onSubmit={submit} noValidate className="space-y-5 p-5 sm:p-6">
          <Field label="Test name" error={errors.title} required>
            {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Thermodynamics Chapter Test" />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type">
              {(p) => (
                <Select {...p} value={kind} onChange={(e) => setKind(e.target.value as TestKind)}>
                  {Object.entries(KIND_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Exam category">
              {(p) => (
                <Select {...p} value={examId} onChange={(e) => setExamId(e.target.value as ExamId | "")}>
                  <option value="">None (standalone)</option>
                  {EXAMS.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <ChipGroup label="Subjects (one section is created per subject)" value={subjectIds} onChange={setSubjectIds} options={SUBJECTS.map((s) => ({ value: s.id, label: s.name }))} error={errors.subjects} />
          <div>
            <p className="mb-2 text-sm font-semibold text-fg">Timing</p>
            <Segmented label="Timing mode" value={timingMode} onChange={setTimingMode} options={[{ value: "overall", label: "One overall timer" }, { value: "sectional", label: "Section timers" }]} />
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-5">
            <ButtonLink href="/admin/tests" variant="secondary">
              Cancel
            </ButtonLink>
            <Button type="submit">Create test</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

/* ------------------------------ Editor ------------------------------ */

export function TestEditorPage({ testId }: { testId: string }) {
  const { state, admin } = useSession();
  if (!admin || !hasPermission(admin, "tests")) return <Restricted what="tests" />;
  const test = state.tests.find((t) => t.id === testId);
  if (!test) return <EmptyState icon={<ClipboardList />} title="Test not found" action={<ButtonLink href="/admin/tests">Back to tests</ButtonLink>} />;
  return <TestEditor key={`${test.id}:${test.updatedAt}`} test={test} adminId={admin.id} />;
}

function questionIssue(q: Question): string | null {
  if (q.text.trim().length < 5) return "Question text is too short";
  if (q.type === "numerical") return q.numerical && Number.isFinite(q.numerical.value) ? null : "Numerical answer missing";
  if (q.options.length < 2 || q.options.some((o) => !o.text.trim())) return "Every option needs text";
  if (q.type === "single" && q.correctOptionIds.length !== 1) return "Select exactly one correct option";
  if (q.type === "multi" && q.correctOptionIds.length < 1) return "Select at least one correct option";
  return null;
}

function testIssues(t: Test): string[] {
  const issues: string[] = [];
  if (t.title.trim().length < 5) issues.push("Title must be at least 5 characters.");
  if (!t.sections.length) issues.push("Add at least one section.");
  t.sections.forEach((s) => {
    if (!s.name.trim()) issues.push("Every section needs a name.");
    if (!s.questions.length) issues.push(`“${s.name || "Untitled section"}” has no questions.`);
    if (t.timingMode === "sectional" && s.durationMin <= 0) issues.push(`Set a time for “${s.name}”.`);
    s.questions.forEach((q, i) => {
      const issue = questionIssue(q);
      if (issue) issues.push(`${s.name} Q${i + 1}: ${issue}.`);
    });
  });
  if (t.timingMode === "overall" && t.durationMin <= 0) issues.push("Set a test duration.");
  if (t.defaultMarks.correct <= 0) issues.push("Marks for a correct answer must be positive.");
  if (t.defaultMarks.incorrect > 0) issues.push("Incorrect-answer marks must be zero or negative.");
  return [...new Set(issues)];
}

function TestEditor({ test, adminId }: { test: Test; adminId: string }) {
  const { state } = useSession();
  const [tab, setTab] = useState<"settings" | "questions" | "preview">(questionCount(test) === 0 ? "questions" : "settings");
  const [draft, setDraft] = useState<Test>(test);
  const [issues, setIssues] = useState<string[]>([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(test);
  const attempts = state.attempts.filter((a) => a.testId === test.id).length;

  const save = (published?: boolean) => {
    const next = { ...draft, published: published ?? draft.published };
    if (next.published) {
      const problems = testIssues(next);
      setIssues(problems);
      if (problems.length) {
        toast({ title: "Can't publish yet", description: `${problems.length} issue${problems.length > 1 ? "s" : ""} to fix.`, tone: "error" });
        return;
      }
    } else setIssues([]);
    saveTest(next, adminId);
    toast({
      title: published === true ? "Test published" : published === false ? "Test unpublished" : "Test saved",
      description: attempts > 0 && dirty ? `Saved as v${test.version + 1}. Past attempts keep v${test.version}.` : undefined,
      simulated: true,
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <Link href="/admin/tests" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-fg">
        <ArrowLeft className="size-4" /> Tests
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold">{draft.title || "Untitled test"}</h1>
            <Badge tone={test.published ? "green" : "slate"} dot>
              {test.published ? "Published" : "Unpublished"}
            </Badge>
            {test.isDemo && (
              <Badge tone="brand">
                <Gift /> Free demo
              </Badge>
            )}
            <Badge tone="slate">v{test.version}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {draft.sections.length} sections · {questionCount(draft)} questions · {totalDurationMin(draft)} min · max {maxScoreOf(draft)} marks
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {test.published && (
            <ButtonLink href={`/tests/${test.id}`} target="_blank" variant="secondary">
              <ExternalLink /> Learner view
            </ButtonLink>
          )}
          {test.isDemo ? (
            <Button variant="secondary" disabled title="The demo test must stay published">
              Demo stays published
            </Button>
          ) : test.published ? (
            <Button variant="secondary" onClick={() => save(false)}>
              <EyeOff /> Unpublish
            </Button>
          ) : (
            <Button onClick={() => save(true)}>
              <Eye /> {dirty ? "Save & publish" : "Publish"}
            </Button>
          )}
        </div>
      </div>

      {attempts > 0 && (
        <Callout tone="info" icon={<History />} title={`${attempts} submitted attempt${attempts > 1 ? "s" : ""} use this test`}>
          Saving changes creates version v{test.version + 1}. Historical results keep the exact questions, answers and marking of the version they were taken on.
        </Callout>
      )}
      {issues.length > 0 && (
        <Callout tone="danger" title="Fix these before publishing">
          <ul className="mt-1 list-disc pl-4">
            {issues.slice(0, 8).map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </Callout>
      )}

      <Tabs
        label="Test editor"
        value={tab}
        onChange={setTab}
        items={[
          { value: "settings", label: "Settings" },
          { value: "questions", label: "Sections & questions", count: questionCount(draft) },
          { value: "preview", label: "Instructions preview" },
        ]}
      />

      {tab === "settings" && <SettingsForm draft={draft} setDraft={setDraft} />}
      {tab === "questions" && <SectionsEditor draft={draft} setDraft={setDraft} />}
      {tab === "preview" && <InstructionsPreview draft={draft} />}

      <div className={cn("fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur transition-transform lg:left-64", dirty ? "translate-y-0" : "invisible translate-y-full")} aria-hidden={!dirty}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-fg">
            <span className="size-2 rounded-full bg-amber-500" /> Unsaved changes {attempts > 0 && <span className="hidden font-normal text-slate-500 sm:inline">· will save as v{test.version + 1}</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setDraft(test); setIssues([]); }} tabIndex={dirty ? 0 : -1}>
              <Undo2 /> Discard
            </Button>
            <Button onClick={() => save()} tabIndex={dirty ? 0 : -1}>
              <Save /> Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberInput({ value, onChange, label, min, step = 1, suffix }: { value: number; onChange: (n: number) => void; label: string; min?: number; step?: number; suffix?: string }) {
  return (
    <Field label={label}>
      {(p) => (
        <div className="relative">
          <Input {...p} type="number" value={Number.isFinite(value) ? value : ""} min={min} step={step} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} className={suffix ? "pr-12" : undefined} />
          {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
        </div>
      )}
    </Field>
  );
}

function SettingsForm({ draft, setDraft }: { draft: Test; setDraft: (t: Test) => void }) {
  const { state } = useSession();
  const set = <K extends keyof Test>(k: K, v: Test[K]) => setDraft({ ...draft, [k]: v });
  const setMarks = (patch: Partial<Marks>) => set("defaultMarks", { ...draft.defaultMarks, ...patch });
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Basics & classification" />
        <div className="space-y-5 p-5">
          <Field label="Test name" required>
            {(p) => <Input {...p} value={draft.title} onChange={(e) => set("title", e.target.value)} />}
          </Field>
          <Field label="Description">
            {(p) => <Textarea {...p} rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type">
              {(p) => (
                <Select {...p} value={draft.kind} onChange={(e) => set("kind", e.target.value as TestKind)}>
                  {Object.entries(KIND_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Exam category">
              {(p) => (
                <Select {...p} value={draft.examId ?? ""} onChange={(e) => set("examId", (e.target.value || undefined) as ExamId | undefined)}>
                  <option value="">None (standalone)</option>
                  {EXAMS.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <ChipGroup label="Subjects" value={draft.subjectIds} onChange={(v) => set("subjectIds", v)} options={SUBJECTS.map((s) => ({ value: s.id, label: s.name }))} />
          <Field label="Linked course (optional)">
            {(p) => (
              <Select {...p} value={draft.courseId ?? ""} onChange={(e) => set("courseId", e.target.value || undefined)}>
                <option value="">Not linked</option>
                {state.courses
                  .filter((c) => c.status !== "archived")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Timing" />
          <div className="space-y-4 p-5">
            <Segmented
              label="Timing mode"
              value={draft.timingMode}
              onChange={(v) => set("timingMode", v)}
              options={[
                { value: "overall", label: "One overall countdown" },
                { value: "sectional", label: "Independent section timers" },
              ]}
            />
            {draft.timingMode === "overall" ? (
              <div className="max-w-48">
                <NumberInput label="Duration" value={draft.durationMin} min={1} onChange={(n) => set("durationMin", n)} suffix="min" />
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Set each section&apos;s time in <strong>Sections &amp; questions</strong>. Total: {totalDurationMin(draft)} min. When a section&apos;s time ends it locks and the learner continues with the remaining sections.
              </p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Marking" description="Defaults for every question; individual questions can override." />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-3 gap-3">
              <NumberInput label="Correct" value={draft.defaultMarks.correct} min={0} onChange={(n) => setMarks({ correct: n })} />
              <NumberInput label="Incorrect" value={draft.defaultMarks.incorrect} step={0.25} onChange={(n) => setMarks({ incorrect: n })} />
              <NumberInput label="Unattempted" value={draft.defaultMarks.unattempted} onChange={(n) => setMarks({ unattempted: n })} />
            </div>
            <Field label="Multi-select marking rule" hint={describeMultiRule(draft.multiMarking, draft.defaultMarks)}>
              {(p) => (
                <Select {...p} value={draft.multiMarking} onChange={(e) => set("multiMarking", e.target.value as MultiMarkingRule)}>
                  <option value="all-or-nothing">All or nothing</option>
                  <option value="partial">Partial marking (JEE Advanced style)</option>
                </Select>
              )}
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Attempts & results" />
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-end gap-4">
              <Switch className="flex-1" checked={draft.attemptLimit === null} onChange={(v) => set("attemptLimit", v ? null : 3)} label="Unlimited attempts" description="Default for practice tests." />
              {draft.attemptLimit !== null && (
                <div className="w-32">
                  <NumberInput label="Attempt limit" value={draft.attemptLimit} min={1} onChange={(n) => set("attemptLimit", Math.max(1, n || 1))} />
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-fg">Answer key & solutions</p>
              <Segmented
                label="Result release"
                value={draft.resultRelease}
                onChange={(v) => setDraft({ ...draft, resultRelease: v, solutionsReleased: v === "immediate" })}
                options={[
                  { value: "immediate", label: "Show immediately" },
                  { value: "manual", label: "Release manually" },
                ]}
              />
              <p className="mt-2 text-xs text-slate-500">The score is always shown immediately after submission.</p>
            </div>
            {draft.resultRelease === "manual" && (
              <Switch checked={draft.solutionsReleased} onChange={(v) => set("solutionsReleased", v)} label="Solutions released" description="When on, learners can open the detailed answer review." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SectionsEditor({ draft, setDraft }: { draft: Test; setDraft: (t: Test) => void }) {
  const [editing, setEditing] = useState<{ sectionId: string; question?: Question } | null>(null);
  const [removeSection, setRemoveSection] = useState<TestSection | null>(null);
  const setSections = (sections: TestSection[]) => setDraft({ ...draft, sections });
  const updateSection = (id: string, patch: Partial<TestSection>) => setSections(draft.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-4">
      {draft.sections.map((s, si) => (
        <Card key={s.id}>
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-end">
            <div className="grid grid-cols-1 flex-1 gap-3 sm:grid-cols-[1fr_180px_auto]">
              <Field label={`Section ${si + 1} name`}>
                {(p) => <Input {...p} value={s.name} onChange={(e) => updateSection(s.id, { name: e.target.value })} />}
              </Field>
              <Field label="Subject">
                {(p) => (
                  <Select {...p} value={s.subjectId ?? ""} onChange={(e) => updateSection(s.id, { subjectId: (e.target.value || undefined) as SubjectId | undefined })}>
                    <option value="">Mixed</option>
                    {SUBJECTS.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {draft.timingMode === "sectional" && (
                <div className="w-32">
                  <NumberInput label="Section time" value={s.durationMin} min={1} onChange={(n) => updateSection(s.id, { durationMin: n })} suffix="min" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <IconButton label="Move section up" size="sm" disabled={si === 0} onClick={() => setSections(moveItem(draft.sections, si, si - 1))}>
                <ArrowUp />
              </IconButton>
              <IconButton label="Move section down" size="sm" disabled={si === draft.sections.length - 1} onClick={() => setSections(moveItem(draft.sections, si, si + 1))}>
                <ArrowDown />
              </IconButton>
              <IconButton label="Remove section" size="sm" className="hover:text-red-600 dark:hover:text-red-400" onClick={() => (s.questions.length ? setRemoveSection(s) : setSections(draft.sections.filter((x) => x.id !== s.id)))}>
                <Trash2 />
              </IconButton>
            </div>
          </div>
          {s.questions.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-500">No questions yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {s.questions.map((q, qi) => {
                const issue = questionIssue(q);
                const m = marksFor(q, draft.defaultMarks);
                return (
                  <li key={q.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 w-7 shrink-0 text-xs font-bold text-slate-400">Q{qi + 1}</span>
                    <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold", q.type === "single" ? "bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300" : q.type === "multi" ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300" : "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200")}>
                      {QUESTION_TYPE_SHORT[q.type]}
                    </span>
                    <button type="button" onClick={() => setEditing({ sectionId: s.id, question: q })} className="min-w-0 flex-1 text-left">
                      <span className="line-clamp-2 text-sm text-fg hover:text-brand-700 dark:hover:text-brand-300">{q.text || <em className="text-slate-400">Empty question</em>}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                        <span>
                          +{m.correct} / {m.incorrect}
                          {q.marks && " (custom)"}
                        </span>
                        <span>{q.difficulty}</span>
                        {issue && <span className="font-semibold text-red-600 dark:text-red-400">{issue}</span>}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center">
                      <IconButton label="Move up" size="sm" disabled={qi === 0} onClick={() => updateSection(s.id, { questions: moveItem(s.questions, qi, qi - 1) })}>
                        <ArrowUp />
                      </IconButton>
                      <IconButton label="Move down" size="sm" disabled={qi === s.questions.length - 1} onClick={() => updateSection(s.id, { questions: moveItem(s.questions, qi, qi + 1) })}>
                        <ArrowDown />
                      </IconButton>
                      <IconButton
                        label="Duplicate"
                        size="sm"
                        onClick={() => {
                          const copyId = uid("q");
                          const idMap = new Map(q.options.map((o) => [o.id, uid("o")]));
                          const dup: Question = { ...q, id: copyId, options: q.options.map((o) => ({ ...o, id: idMap.get(o.id)! })), correctOptionIds: q.correctOptionIds.map((c) => idMap.get(c)!) };
                          updateSection(s.id, { questions: [...s.questions.slice(0, qi + 1), dup, ...s.questions.slice(qi + 1)] });
                        }}
                      >
                        <Copy />
                      </IconButton>
                      <IconButton label="Edit" size="sm" onClick={() => setEditing({ sectionId: s.id, question: q })}>
                        <Pencil />
                      </IconButton>
                      <IconButton label="Delete" size="sm" className="hover:text-red-600 dark:hover:text-red-400" onClick={() => updateSection(s.id, { questions: s.questions.filter((x) => x.id !== q.id) })}>
                        <Trash2 />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="border-t border-line px-4 py-2.5">
            <Button variant="ghost" size="sm" onClick={() => setEditing({ sectionId: s.id })}>
              <Plus /> Add question
            </Button>
          </div>
        </Card>
      ))}
      <Button variant="outline" onClick={() => setSections([...draft.sections, { id: uid("s"), name: `Section ${draft.sections.length + 1}`, durationMin: 10, questions: [] }])}>
        <Plus /> Add section
      </Button>

      <QuestionDialog
        key={editing ? `${editing.sectionId}:${editing.question?.id ?? "new"}` : "closed"}
        open={!!editing}
        question={editing?.question}
        defaultSubject={draft.sections.find((s) => s.id === editing?.sectionId)?.subjectId ?? draft.subjectIds[0] ?? "physics"}
        defaults={draft.defaultMarks}
        multiRule={draft.multiMarking}
        onClose={() => setEditing(null)}
        onSave={(q) => {
          if (!editing) return;
          const section = draft.sections.find((s) => s.id === editing.sectionId)!;
          const exists = section.questions.some((x) => x.id === q.id);
          updateSection(section.id, { questions: exists ? section.questions.map((x) => (x.id === q.id ? q : x)) : [...section.questions, q] });
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={!!removeSection}
        onClose={() => setRemoveSection(null)}
        onConfirm={() => {
          if (removeSection) setSections(draft.sections.filter((x) => x.id !== removeSection.id));
          setRemoveSection(null);
        }}
        tone="danger"
        title={`Remove “${removeSection?.name}”?`}
        description={`Its ${removeSection?.questions.length} questions will be removed when you save.`}
        confirmLabel="Remove section"
      />
    </div>
  );
}

function QuestionDialog({
  open,
  question,
  defaultSubject,
  defaults,
  multiRule,
  onClose,
  onSave,
}: {
  open: boolean;
  question?: Question;
  defaultSubject: SubjectId;
  defaults: Marks;
  multiRule: MultiMarkingRule;
  onClose: () => void;
  onSave: (q: Question) => void;
}) {
  const [q, setQ] = useState<Question>(
    () =>
      question ?? {
        id: uid("q"),
        type: "single",
        text: "",
        subjectId: defaultSubject,
        options: [0, 1, 2, 3].map(() => ({ id: uid("o"), text: "" })),
        correctOptionIds: [],
        explanation: "",
        difficulty: "Medium",
      },
  );
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Question>(k: K, v: Question[K]) => setQ((prev) => ({ ...prev, [k]: v }));

  const changeType = (type: QuestionType) => {
    setQ((prev) => ({
      ...prev,
      type,
      correctOptionIds: type === "single" ? prev.correctOptionIds.slice(0, 1) : prev.correctOptionIds,
      options: type === "numerical" ? prev.options : prev.options.length ? prev.options : [0, 1, 2, 3].map(() => ({ id: uid("o"), text: "" })),
      numerical: type === "numerical" ? prev.numerical ?? { value: NaN, tolerance: 0, precision: 0, allowNegative: false } : prev.numerical,
    }));
  };

  const toggleCorrect = (id: string) => {
    if (q.type === "single") set("correctOptionIds", [id]);
    else set("correctOptionIds", q.correctOptionIds.includes(id) ? q.correctOptionIds.filter((x) => x !== id) : [...q.correctOptionIds, id]);
  };

  const submit = () => {
    const cleaned: Question = q.type === "numerical" ? { ...q, options: [], correctOptionIds: [] } : { ...q, numerical: undefined };
    const issue = questionIssue(cleaned);
    if (issue) return setError(issue);
    if (cleaned.type === "numerical" && (cleaned.numerical!.tolerance < 0 || !Number.isFinite(cleaned.numerical!.tolerance))) return setError("Tolerance must be zero or positive");
    onSave(cleaned);
  };

  const m = q.marks ?? defaults;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={question ? "Edit question" : "Add question"}
      footer={
        <>
          {error && <p className="mr-auto self-center text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{question ? "Update question" : "Add question"}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-fg">Question type</p>
            <Segmented
              label="Question type"
              value={q.type}
              onChange={changeType}
              options={[
                { value: "single", label: "Single correct" },
                { value: "multi", label: "Multi-select" },
                { value: "numerical", label: "Numerical" },
              ]}
            />
          </div>
          <Field label="Question" required>
            {(p) => <Textarea {...p} rows={4} value={q.text} onChange={(e) => { set("text", e.target.value); setError(null); }} placeholder="Type the question. Unicode symbols like ², √, π and → are supported." />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Subject">
              {(p) => (
                <Select {...p} value={q.subjectId} onChange={(e) => set("subjectId", e.target.value as SubjectId)}>
                  {SUBJECTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Difficulty">
              {(p) => (
                <Select {...p} value={q.difficulty} onChange={(e) => set("difficulty", e.target.value as Question["difficulty"])}>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </Select>
              )}
            </Field>
          </div>

          {q.type === "numerical" ? (
            <fieldset className="rounded-xl border border-line p-4">
              <legend className="px-1 text-sm font-semibold text-fg">Numerical answer</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <NumberInput label="Correct value" value={q.numerical?.value ?? NaN} step={0.01} onChange={(n) => set("numerical", { ...q.numerical!, value: n })} />
                <NumberInput label="Tolerance (±)" value={q.numerical?.tolerance ?? 0} min={0} step={0.01} onChange={(n) => set("numerical", { ...q.numerical!, tolerance: n })} />
                <NumberInput label="Decimal places" value={q.numerical?.precision ?? 0} min={0} onChange={(n) => set("numerical", { ...q.numerical!, precision: Math.max(0, Math.round(n || 0)) })} />
              </div>
              <Switch className="mt-4" checked={q.numerical?.allowNegative ?? false} onChange={(v) => set("numerical", { ...q.numerical!, allowNegative: v })} label="Accept negative answers" />
            </fieldset>
          ) : (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-fg">Options · mark the correct {q.type === "single" ? "answer" : "answers"}</legend>
              <ul className="space-y-2">
                {q.options.map((o, i) => {
                  const correct = q.correctOptionIds.includes(o.id);
                  return (
                    <li key={o.id} className={cn("flex items-center gap-2 rounded-xl border-2 p-2", correct ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10" : "border-line")}>
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-bold text-slate-600">{String.fromCharCode(65 + i)}</span>
                      <input
                        value={o.text}
                        onChange={(e) => set("options", q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        aria-label={`Option ${String.fromCharCode(65 + i)} text`}
                        className="h-9 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm text-fg outline-none focus:bg-surface focus:ring-2 focus:ring-brand-300"
                      />
                      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-surface">
                        <input type={q.type === "single" ? "radio" : "checkbox"} name="correct" checked={correct} onChange={() => { toggleCorrect(o.id); setError(null); }} className="accent-emerald-600" />
                        Correct
                      </label>
                      <IconButton
                        label={`Remove option ${String.fromCharCode(65 + i)}`}
                        size="sm"
                        disabled={q.options.length <= 2}
                        onClick={() => setQ((prev) => ({ ...prev, options: prev.options.filter((x) => x.id !== o.id), correctOptionIds: prev.correctOptionIds.filter((x) => x !== o.id) }))}
                      >
                        <X />
                      </IconButton>
                    </li>
                  );
                })}
              </ul>
              {q.options.length < 6 && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => set("options", [...q.options, { id: uid("o"), text: "" }])}>
                  <Plus /> Add option
                </Button>
              )}
            </fieldset>
          )}

          <div className="rounded-xl border border-line p-4">
            <Switch checked={!!q.marks} onChange={(v) => set("marks", v ? { ...defaults } : undefined)} label="Custom marks for this question" description={`Test default: +${defaults.correct} / ${defaults.incorrect} / ${defaults.unattempted}`} />
            {q.marks && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <NumberInput label="Correct" value={q.marks.correct} onChange={(n) => set("marks", { ...q.marks!, correct: n })} />
                <NumberInput label="Incorrect" value={q.marks.incorrect} step={0.25} onChange={(n) => set("marks", { ...q.marks!, incorrect: n })} />
                <NumberInput label="Unattempted" value={q.marks.unattempted} onChange={(n) => set("marks", { ...q.marks!, unattempted: n })} />
              </div>
            )}
          </div>
          <Field label="Explanation (shown in answer review)">
            {(p) => <Textarea {...p} rows={3} value={q.explanation} onChange={(e) => set("explanation", e.target.value)} />}
          </Field>
        </div>

        <aside className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Learner preview</p>
          <div className="rounded-2xl border border-line bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-fg">Question 1</span>
              <span className="flex gap-1">
                <span className="rounded bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">+{m.correct}</span>
                <span className="rounded bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 text-red-700 dark:text-red-300">{m.incorrect}</span>
              </span>
            </div>
            <p className="mt-3 text-sm font-medium whitespace-pre-wrap text-fg">{q.text || <span className="text-slate-400">Your question appears here…</span>}</p>
            {q.type === "numerical" ? (
              <div className="mt-3 h-10 rounded-lg border-2 border-line-strong bg-surface px-3 py-2 font-mono text-sm text-slate-400">Answer</div>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {q.options.map((o, i) => (
                  <li key={o.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs">
                    <span className={cn("size-3.5 shrink-0 border border-slate-300", q.type === "single" ? "rounded-full" : "rounded")} />
                    <span className="font-bold text-slate-500">{String.fromCharCode(65 + i)}</span>
                    <span className="truncate text-fg">{o.text || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-slate-500">{QUESTION_TYPE_LABEL[q.type]}{q.type === "multi" && ` · ${multiRule === "partial" ? "partial marking" : "all or nothing"}`}</p>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

function InstructionsPreview({ draft }: { draft: Test }) {
  const types = [...new Set(draft.sections.flatMap((s) => s.questions.map((q) => q.type)))];
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-extrabold">What learners see before starting</h2>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          ["Duration", `${totalDurationMin(draft)} min`],
          ["Timing", draft.timingMode === "sectional" ? "Section timers" : "Overall timer"],
          ["Questions", questionCount(draft)],
          ["Maximum marks", maxScoreOf(draft)],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-xl bg-brand-50/70 dark:bg-brand-400/10 p-3">
            <dt className="text-xs font-semibold text-brand-800 dark:text-brand-200">{k}</dt>
            <dd className="text-base font-extrabold text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-5 list-disc space-y-2 pl-5 text-sm">
        {draft.sections.map((s) => (
          <li key={s.id}>
            <strong className="text-fg">{s.name}</strong>: {s.questions.length} questions{draft.timingMode === "sectional" && `, ${s.durationMin} min`}
          </li>
        ))}
        {types.includes("single") && <li>Single correct: +{draft.defaultMarks.correct}, {draft.defaultMarks.incorrect} for incorrect.</li>}
        {types.includes("multi") && <li>Multi-select: {describeMultiRule(draft.multiMarking, draft.defaultMarks)}</li>}
        {types.includes("numerical") && <li>Numerical: answers accepted within the configured tolerance.</li>}
        <li>Attempts: {draft.attemptLimit === null ? "unlimited" : draft.attemptLimit}.</li>
        <li>Solutions: {draft.resultRelease === "immediate" ? "shown immediately" : draft.solutionsReleased ? "released" : "released later by admin"}.</li>
      </ul>
      {draft.published && (
        <ButtonLink href={`/exam/${draft.id}`} target="_blank" variant="secondary" className="mt-5">
          <ExternalLink /> Open live instructions screen
        </ButtonLink>
      )}
    </Card>
  );
}
