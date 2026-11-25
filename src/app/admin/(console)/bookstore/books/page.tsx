import type { Metadata } from "next";
import { BooksAdminPage } from "@/features/admin/bookstore-books";

export const metadata: Metadata = { title: "Books & inventory" };

export default function Page() {
  return <BooksAdminPage />;
}
