import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import type { Metadata } from "next";
import { TestDetail } from "@/features/tests/test-detail";
import { SERVER_ANCHOR } from "@/lib/mock/seed";
import { seedTests } from "@/lib/mock/tests";

const seed = seedTests(SERVER_ANCHOR);

export function generateStaticParams() {
  return seed.map((t) => ({ testId: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/tests/[testId]">): Promise<Metadata> {
  const { testId } = await params;
  return { title: seed.find((t) => t.id === testId)?.title ?? "Test" };
}

export default function TestPage({ params }: PageProps<"/tests/[testId]">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <Suspense fallback={<PageSkeleton variant="page" />}>
      {params.then(({ testId }) => (
        <TestDetail testId={testId} />
      ))}
    </Suspense>
  );
}
