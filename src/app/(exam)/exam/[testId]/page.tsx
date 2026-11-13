import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import type { Metadata } from "next";
import { ExamInstructions } from "@/features/exam/exam-instructions";
import { SERVER_ANCHOR } from "@/lib/mock/seed";
import { seedTests } from "@/lib/mock/tests";

const seed = seedTests(SERVER_ANCHOR);

export function generateStaticParams() {
  return seed.map((t) => ({ testId: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/exam/[testId]">): Promise<Metadata> {
  const { testId } = await params;
  return { title: `Instructions · ${seed.find((t) => t.id === testId)?.title ?? "Test"}` };
}

export default function ExamInstructionsPage({ params }: PageProps<"/exam/[testId]">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <Suspense fallback={<PageSkeleton variant="full" />}>
      {params.then(({ testId }) => (
        <ExamInstructions testId={testId} />
      ))}
    </Suspense>
  );
}
