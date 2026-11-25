import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { BookCatalog } from "@/features/bookstore/storefront";

export const metadata: Metadata = { title: "All books" };

export default function BookCatalogPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BookCatalog />
    </Suspense>
  );
}
