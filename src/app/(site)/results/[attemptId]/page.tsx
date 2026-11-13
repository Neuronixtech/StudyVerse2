import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import type { Metadata } from "next";
import { ResultView } from "@/features/results/result-view";
import { createSeed, SERVER_ANCHOR } from "@/lib/mock/seed";

export const metadata: Metadata = { title: "Test result" };

export function generateStaticParams() {
  return createSeed(SERVER_ANCHOR).attempts.map((a) => ({ attemptId: a.id }));
}

export default function ResultPage({ params }: PageProps<"/results/[attemptId]">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <Suspense fallback={<PageSkeleton variant="page" />}>
      {params.then(({ attemptId }) => (
        <ResultView attemptId={attemptId} />
      ))}
    </Suspense>
  );
}
