import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import type { Metadata } from "next";
import { TestEditorPage } from "@/features/admin/admin-tests";
import { SERVER_ANCHOR } from "@/lib/mock/seed";
import { seedTests } from "@/lib/mock/tests";

export const metadata: Metadata = { title: "Edit test" };

export function generateStaticParams() {
  return seedTests(SERVER_ANCHOR).map((t) => ({ testId: t.id }));
}

export default function Page({ params }: PageProps<"/admin/tests/[testId]">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <Suspense fallback={<PageSkeleton variant="admin" />}>
      {params.then(({ testId }) => (
        <TestEditorPage testId={testId} />
      ))}
    </Suspense>
  );
}
