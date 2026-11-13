import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBanner } from "@/components/page-banner";
import { SkeletonCards } from "@/components/ui/feedback";
import { CoursesCatalog } from "@/features/courses/courses-catalog";

export const metadata: Metadata = {
  title: "Courses",
  description: "Browse recorded JEE Main, JEE Advanced and MHT-CET courses with free preview lessons.",
};

export default function CoursesPage() {
  return (
    <>
      <PageBanner
        crumbs={[{ href: "/", label: "Home" }, { label: "Courses" }]}
        title="Explore courses"
        description="Structured Physics, Chemistry and Mathematics courses. Every course includes a free preview lesson — no account needed."
      />
      <Suspense
        fallback={
          <div className="container-page py-10">
            <SkeletonCards count={6} />
          </div>
        }
      >
        <CoursesCatalog />
      </Suspense>
    </>
  );
}
