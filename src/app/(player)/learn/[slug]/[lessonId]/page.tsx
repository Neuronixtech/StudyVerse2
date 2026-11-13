import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import type { Metadata } from "next";
import { PrototypeToolbar } from "@/components/layout/prototype-toolbar";
import { LessonPlayer } from "@/features/player/lesson-player";
import { seedCourses } from "@/lib/mock/courses";
import { SERVER_ANCHOR } from "@/lib/mock/seed";

const seed = seedCourses(SERVER_ANCHOR);

export function generateStaticParams() {
  return seed.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => ({ slug: c.slug, lessonId: l.id }))));
}

export async function generateMetadata({ params }: PageProps<"/learn/[slug]/[lessonId]">): Promise<Metadata> {
  const { slug, lessonId } = await params;
  const course = seed.find((c) => c.slug === slug);
  const lesson = course?.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  return { title: lesson ? `${lesson.title} · ${course?.title}` : "Lesson" };
}

export default function LessonPage({ params }: PageProps<"/learn/[slug]/[lessonId]">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <>
      <Suspense fallback={<PageSkeleton variant="page" />}>
        {params.then(({ slug, lessonId }) => (
          <LessonPlayer slug={slug} lessonId={lessonId} />
        ))}
      </Suspense>
      <PrototypeToolbar />
    </>
  );
}
