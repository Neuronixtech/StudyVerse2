import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import type { Metadata } from "next";
import { LearnerDetail } from "@/features/admin/admin-learners";
import { createSeed, SERVER_ANCHOR } from "@/lib/mock/seed";

export const metadata: Metadata = { title: "Learner details" };

export function generateStaticParams() {
  return createSeed(SERVER_ANCHOR).learners.map((l) => ({ learnerId: l.id }));
}

export default function Page({ params }: PageProps<"/admin/learners/[learnerId]">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <Suspense fallback={<PageSkeleton variant="admin" />}>
      {params.then(({ learnerId }) => (
        <LearnerDetail learnerId={learnerId} />
      ))}
    </Suspense>
  );
}
