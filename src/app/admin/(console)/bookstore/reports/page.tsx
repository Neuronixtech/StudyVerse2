import type { Metadata } from "next";
import { ReportsPage } from "@/features/admin/bookstore-ops";

export const metadata: Metadata = { title: "Bookstore reports" };

export default function Page() {
  return <ReportsPage />;
}
