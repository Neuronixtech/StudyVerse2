import type { Metadata } from "next";
import { BookstoreDashboard } from "@/features/admin/bookstore-ops";

export const metadata: Metadata = { title: "Bookstore" };

export default function Page() {
  return <BookstoreDashboard />;
}
