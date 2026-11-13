import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import type { Metadata } from "next";
import { ExamRunner } from "@/features/exam/exam-runner";
import { SERVER_ANCHOR } from "@/lib/mock/seed";
import { seedTests } from "@/lib/mock/tests";

const seed = seedTests(SERVER_ANCHOR);

export function generateStaticParams() {
  return seed.map((t) => ({ testId: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/exam/[testId]/live">): Promise<Metadata> {
  const { testId } = await params;
  return { title: seed.find((t) => t.id === testId)?.title ?? "Exam" };
}

export default function LiveExamPage({ params }: PageProps<"/exam/[testId]/live">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <Suspense fallback={<PageSkeleton variant="full" />}>
      {params.then(({ testId }) => (
        <ExamRunner testId={testId} />
      ))}
    </Suspense>
  );
}
