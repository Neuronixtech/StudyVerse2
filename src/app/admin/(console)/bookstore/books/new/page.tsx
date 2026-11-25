import type { Metadata } from "next";
import { BookCreatePage } from "@/features/admin/bookstore-books";

export const metadata: Metadata = { title: "Add book" };

export default function Page() {
  return <BookCreatePage />;
}
