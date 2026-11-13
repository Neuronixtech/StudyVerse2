"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ClipboardList, Gift, Timer } from "lucide-react";
import { TestCard } from "@/components/cards";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState, SkeletonCards } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { attemptsFor, bestAttempt, demoTest, publishedTests, testAccess } from "@/lib/access";
import { questionCount, questionTypesIn, QUESTION_TYPE_LABEL, totalDurationMin } from "@/lib/exam";
import { useSession, useSimulatedLoad } from "@/lib/hooks";
import { EXAMS, SUBJECTS } from "@/lib/mock/catalog";
import type { ExamId, SubjectId, Test } from "@/lib/types";

type KindFilter = "all" | Test["kind"];
type AccessFilter = "all" | "unlocked" | "locked";

export function TestsCatalog() {
  const { state, learner, sub } = useSession();
  const [kind, setKind] = useState<KindFilter>("all");
  const [exam, setExam] = useState<ExamId | "">("");
  const [subject, setSubject] = useState<SubjectId | "">("");
  const [access, setAccess] = useState<AccessFilter>("all");
  const load = useSimulatedLoad("tests");
  const demo = demoTest(state);

  const all = publishedTests(state).filter((t) => !t.isDemo);
  const results = useMemo(
    () =>
      all.filter((t) => {
        if (kind !== "all" && t.kind !== kind) return false;
        if (exam && t.examId !== exam) return false;
        if (subject && !t.subjectIds.includes(subject)) return false;
        const allowed = testAccess(t, learner?.id ?? null, sub, attemptsFor(state, t.id, learner?.id).length).allowed;
        if (access === "unlocked" && !allowed) return false;
        if (access === "locked" && allowed) return false;
        return true;
      }),
    [all, kind, exam, subject, access, learner?.id, sub, state],
  );

  const count = (k: KindFilter) => (k === "all" ? all.length : all.filter((t) => t.kind === k).length);

  return (
    <div className="container-page py-10">
      {demo && (
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-r from-brand-600 to-brand-800 p-6 text-white shadow-lift sm:p-8" aria-labelledby="demo-title">
          <div className="bg-grid-faint absolute inset-0 opacity-40" />
          <div className="absolute -right-10 -bottom-16 size-64 rounded-full bg-white/10" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/25">
                <Gift className="size-3.5" /> Free demo · no sign-up required
              </span>
              <h2 id="demo-title" className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">
                {demo.title}
              </h2>
              <p className="mt-2 text-sm text-brand-50/90 sm:text-base">{demo.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">{questionCount(demo)} questions</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">
                  <Timer className="size-3.5" /> {totalDurationMin(demo)} minutes
                </span>
                {questionTypesIn(demo).map((t) => (
                  <span key={t} className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/20">
                    {QUESTION_TYPE_LABEL[t]}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              <ButtonLink href={`/exam/${demo.id}`} variant="white" size="lg">
                Start free demo <ArrowRight />
              </ButtonLink>
              <Link href={`/tests/${demo.id}`} className="text-center text-sm font-semibold text-white/90 hover:underline">
                View test details
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          label="Test type"
          value={kind}
          onChange={setKind}
          items={[
            { value: "all", label: "All tests", count: count("all") },
            { value: "full", label: "Full mocks", count: count("full") },
            { value: "sectional", label: "Sectional", count: count("sectional") },
            { value: "chapter", label: "Chapter tests", count: count("chapter") },
            { value: "practice", label: "Practice", count: count("practice") },
          ]}
          className="lg:flex-1"
        />
        <div className="grid grid-cols-3 gap-2 lg:w-[520px]">
          <Select value={exam} onChange={(e) => setExam(e.target.value as ExamId | "")} aria-label="Filter by exam">
            <option value="">All exams</option>
            {EXAMS.filter((e) => !e.comingSoon).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
          <Select value={subject} onChange={(e) => setSubject(e.target.value as SubjectId | "")} aria-label="Filter by subject">
            <option value="">All subjects</option>
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={access} onChange={(e) => setAccess(e.target.value as AccessFilter)} aria-label="Filter by access">
            <option value="all">Any access</option>
            <option value="unlocked">Available to me</option>
            <option value="locked">Locked</option>
          </Select>
        </div>
      </div>

      <div className="mt-8">
        {load.status === "loading" ? (
          <SkeletonCards count={6} />
        ) : load.status === "error" ? (
          <ErrorState title="Couldn't load tests" onRetry={load.retry} />
        ) : results.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="No tests match these filters"
            description="Try another exam, subject or test type."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setKind("all");
                  setExam("");
                  setSubject("");
                  setAccess("all");
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((t) => {
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
        )}
      </div>
    </div>
  );
}
