import type { Metadata } from "next";
import { TestsAdminPage } from "@/features/admin/admin-tests";

export const metadata: Metadata = { title: "Tests" };

export default function Page() {
  return <TestsAdminPage />;
}
