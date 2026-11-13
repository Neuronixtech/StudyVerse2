import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { SubscribeView } from "@/features/subscribe/subscribe-view";

export const metadata: Metadata = {
  title: "Subscribe",
  description: "One all-access subscription for every StudyVerse course and test. Pay via UPI or bank transfer.",
};

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-16">
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <SubscribeView />
    </Suspense>
  );
}
