import type { Metadata } from "next";
import { CoursesAdminPage } from "@/features/admin/admin-courses";

export const metadata: Metadata = { title: "Courses" };

export default function Page() {
  return <CoursesAdminPage />;
}
