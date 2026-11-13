import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import type { Metadata } from "next";
import { AnswerReview } from "@/features/results/answer-review";
import { createSeed, SERVER_ANCHOR } from "@/lib/mock/seed";

export const metadata: Metadata = { title: "Answer review" };

export function generateStaticParams() {
  return createSeed(SERVER_ANCHOR).attempts.map((a) => ({ attemptId: a.id }));
}

export default function ReviewPage({ params }: PageProps<"/results/[attemptId]/review">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <Suspense fallback={<PageSkeleton variant="page" />}>
      {params.then(({ attemptId }) => (
        <AnswerReview attemptId={attemptId} />
      ))}
    </Suspense>
  );
}
