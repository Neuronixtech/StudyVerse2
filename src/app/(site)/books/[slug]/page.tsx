import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { BookDetail } from "@/features/bookstore/book-detail";
import { seedBooks } from "@/lib/mock/bookstore";
import { SERVER_ANCHOR } from "@/lib/mock/seed";

const seed = seedBooks(SERVER_ANCHOR);

export function generateStaticParams() {
  return seed.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: PageProps<"/books/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const book = seed.find((b) => b.slug === slug);
  return { title: book?.title ?? "Book", description: book?.description };
}

export default function BookPage({ params }: PageProps<"/books/[slug]">) {
  // Param access is wrapped in Suspense so client navigations render a shell instantly
  return (
    <Suspense fallback={<PageSkeleton />}>
      {params.then(({ slug }) => (
        <BookDetail slug={slug} />
      ))}
    </Suspense>
  );
}
