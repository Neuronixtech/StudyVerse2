import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import type { Metadata } from "next";
import { CourseDetail } from "@/features/courses/course-detail";
import { seedCourses } from "@/lib/mock/courses";
import { SERVER_ANCHOR } from "@/lib/mock/seed";

const seed = seedCourses(SERVER_ANCHOR);

export function generateStaticParams() {
  return seed.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = seed.find((c) => c.slug === slug);
  return { title: course?.title ?? "Course", description: course?.subtitle };
}

export default function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <Suspense fallback={<PageSkeleton variant="page" />}>
      {params.then(({ slug }) => (
        <CourseDetail slug={slug} />
      ))}
    </Suspense>
  );
}
