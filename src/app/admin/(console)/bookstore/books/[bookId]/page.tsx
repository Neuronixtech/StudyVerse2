import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { BookEditorPage } from "@/features/admin/bookstore-books";
import { seedBooks } from "@/lib/mock/bookstore";
import { SERVER_ANCHOR } from "@/lib/mock/seed";

export const metadata: Metadata = { title: "Edit book" };

export function generateStaticParams() {
  return seedBooks(SERVER_ANCHOR).map((b) => ({ bookId: b.id }));
}

export default function Page({ params }: PageProps<"/admin/bookstore/books/[bookId]">) {
  return (
    <Suspense fallback={<PageSkeleton variant="admin" />}>
      {params.then(({ bookId }) => (
        <BookEditorPage bookId={bookId} />
      ))}
    </Suspense>
  );
}
