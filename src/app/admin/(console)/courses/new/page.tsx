import type { Metadata } from "next";
import { CourseCreatePage } from "@/features/admin/admin-courses";

export const metadata: Metadata = { title: "New course" };

export default function Page() {
  return <CourseCreatePage />;
}
