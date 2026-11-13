import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import type { Metadata } from "next";
import { CourseEditorPage } from "@/features/admin/admin-courses";
import { seedCourses } from "@/lib/mock/courses";
import { SERVER_ANCHOR } from "@/lib/mock/seed";

export const metadata: Metadata = { title: "Edit course" };

export function generateStaticParams() {
  return seedCourses(SERVER_ANCHOR).map((c) => ({ courseId: c.id }));
}

export default function Page({ params }: PageProps<"/admin/courses/[courseId]">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <Suspense fallback={<PageSkeleton variant="admin" />}>
      {params.then(({ courseId }) => (
        <CourseEditorPage courseId={courseId} />
      ))}
    </Suspense>
  );
}
