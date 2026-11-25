import type { Metadata } from "next";
import { BookstoreSettingsPage } from "@/features/admin/bookstore-ops";

export const metadata: Metadata = { title: "Store settings" };

export default function Page() {
  return <BookstoreSettingsPage />;
}
