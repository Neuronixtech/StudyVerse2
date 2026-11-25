"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, ShieldCheck, ShoppingCart, Truck, Zap } from "lucide-react";
import { BookCard } from "@/components/bookstore/book-card";
import { BookPhotoView, PriceTag, StockBadge } from "@/components/bookstore/book-visuals";
import { Breadcrumbs } from "@/components/page-banner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toast";
import { availableStock, discountPercent, stockState } from "@/lib/bookstore";
import { addToCart, cartKey } from "@/lib/bookstore-store";
import { useSession } from "@/lib/hooks";
import { examName, subjectName } from "@/lib/mock/catalog";
import { cn, formatINR } from "@/lib/utils";

const baseTitle = (t: string) => t.replace(/\s*\([^)]*\)\s*$/, "").trim();

export function BookDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const { state, learner, now } = useSession();
  const book = state.books.find((b) => b.slug === slug);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [qty, setQty] = useState(1);

  if (!book || book.status === "draft") {
    return (
      <div className="container-page py-20">
        <EmptyState icon={<BookOpen />} title="Book not found" description="This book doesn't exist or isn't on sale yet." action={<ButtonLink href="/books/catalog">Browse books</ButtonLink>} />
      </div>
    );
  }
  if (book.status === "archived") {
    return (
      <div className="container-page py-20">
        <EmptyState icon={<BookOpen />} title="This book is no longer sold" description={`“${book.title}” has been archived. Past orders are not affected.`} action={<ButtonLink href="/books/catalog">Find a newer edition</ButtonLink>} />
      </div>
    );
  }

  const photos = [...book.photos].sort((a, b) => (a.id === book.primaryPhotoId ? -1 : b.id === book.primaryPhotoId ? 1 : 0));
  const current = photos[Math.min(photoIndex, photos.length - 1)];
  const available = availableStock(book, state.bookOrders, now);
  const st = stockState(available, state.bookstore);
  const key = cartKey(learner?.id);
  const inCart = (state.carts[key] ?? []).find((c) => c.bookId === book.id)?.qty ?? 0;
  const maxQty = Math.max(0, Math.min(10, available - inCart));
  const quantity = Math.min(qty, Math.max(1, maxQty));
  const editions = state.books.filter((b) => b.id !== book.id && b.status === "published" && baseTitle(b.title) === baseTitle(book.title));
  const related = state.books
    .filter((b) => b.id !== book.id && b.status === "published" && !editions.includes(b) && (b.subjectIds.some((s) => book.subjectIds.includes(s)) || b.examIds.some((e) => book.examIds.includes(e))))
    .sort((a, b) => Number(b.subjectIds.some((s) => book.subjectIds.includes(s))) - Number(a.subjectIds.some((s) => book.subjectIds.includes(s))) || b.sold - a.sold)
    .slice(0, 4);
  const off = discountPercent(book.mrp, book.price);

  const specs: [string, string | undefined][] = [
    ["Author", book.author],
    ["Publisher", book.publisher],
    ["ISBN", book.isbn],
    ["Exam category", book.examIds.map(examName).join(", ")],
    ["Subject", book.subjectIds.map(subjectName).join(", ")],
    ["Language", book.language],
    ["Edition", book.edition],
    ["Format", book.format],
    ["Pages", book.pages ? String(book.pages) : undefined],
  ];

  const add = (go: boolean) => {
    addToCart(key, book.id, quantity);
    setQty(1);
    if (go) router.push("/books/cart");
    else toast({ title: `Added ${quantity} to cart`, description: book.title });
  };

  return (
    <>
      <div className="container-page py-6">
        <Breadcrumbs items={[{ href: "/books", label: "Bookstore" }, { href: "/books/catalog", label: "All books" }, { label: book.title }]} />
      </div>
      <div className="container-page grid grid-cols-1 gap-10 pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Gallery */}
        <section aria-label="Photos" className="lg:sticky lg:top-24 lg:self-start">
          <div
            className="relative grid place-items-center rounded-3xl bg-mist px-10 py-8 sm:px-16"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setPhotoIndex((i) => (i + 1) % photos.length);
              if (e.key === "ArrowLeft") setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
            }}
          >
            <BookPhotoView book={book} photo={current} size="lg" className="w-full max-w-sm" />
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)} className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface text-fg shadow-card hover:bg-slate-50" aria-label="Previous photo">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)} className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface text-fg shadow-card hover:bg-slate-50" aria-label="Next photo">
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
            <p className="mt-4 text-xs font-medium text-slate-500" aria-live="polite">
              {current.label} · {photos.indexOf(current) + 1} of {photos.length}
            </p>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Choose photo">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === photos.indexOf(current)}
                aria-label={p.label}
                onClick={() => setPhotoIndex(i)}
                className={cn("w-16 shrink-0 rounded-lg p-1 ring-2 transition", i === photos.indexOf(current) ? "ring-brand-500" : "ring-transparent hover:ring-line-strong")}
              >
                <BookPhotoView book={book} photo={p} size="xs" />
              </button>
            ))}
          </div>
        </section>

        {/* Details */}
        <section aria-labelledby="book-title">
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {book.examIds.map(examName).join(" · ")} · {book.subjectIds.map(subjectName).join(", ")}
          </p>
          <h1 id="book-title" className="mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            {book.title}
          </h1>
          <p className="mt-2 text-slate-500">
            {book.author ? (
              <>
                by <span className="font-semibold text-fg">{book.author}</span>
              </>
            ) : (
              "Author not listed"
            )}
            {book.publisher && <> · {book.publisher}</>}
            {book.edition && <> · {book.edition}</>}
          </p>

          <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
            <PriceTag mrp={book.mrp} price={book.price} size="lg" />
            {off > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                MRP {formatINR(book.mrp)} · you save {formatINR(book.mrp - book.price)} · inclusive of all taxes (prototype)
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StockBadge state={st} available={available} />
              {inCart > 0 && (
                <Link href="/books/cart" className="text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">
                  {inCart} already in your cart
                </Link>
              )}
            </div>

            {st === "out" ? (
              <Callout tone="warning" className="mt-5" title="Currently out of stock">
                This listing stays visible so you can find it later. Purchasing is disabled until stock is replenished — we don&apos;t take backorders.
              </Callout>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-xl border border-line-strong" role="group" aria-label="Quantity">
                  <button type="button" onClick={() => setQty(Math.max(1, quantity - 1))} disabled={quantity <= 1} className="grid size-11 place-items-center text-slate-600 hover:text-fg disabled:opacity-40" aria-label="Decrease quantity">
                    <Minus className="size-4" />
                  </button>
                  <span className="w-10 text-center font-bold text-fg tabular-nums" aria-live="polite">
                    {maxQty === 0 ? 0 : quantity}
                  </span>
                  <button type="button" onClick={() => setQty(Math.min(maxQty, quantity + 1))} disabled={quantity >= maxQty} className="grid size-11 place-items-center text-slate-600 hover:text-fg disabled:opacity-40" aria-label="Increase quantity">
                    <Plus className="size-4" />
                  </button>
                </div>
                <Button size="lg" onClick={() => add(false)} disabled={maxQty === 0} className="flex-1 sm:flex-none">
                  <ShoppingCart /> Add to cart
                </Button>
                <Button size="lg" variant="dark" onClick={() => add(true)} disabled={maxQty === 0} className="flex-1 sm:flex-none">
                  <Zap /> Buy now
                </Button>
                {maxQty === 0 && <p className="w-full text-xs text-slate-500">You already have all available copies in your cart.</p>}
              </div>
            )}

            <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-slate-600">
              <li className="flex items-start gap-2.5">
                <Truck className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <span>
                  Estimated delivery: <strong className="text-fg">{state.bookstore.deliveryEstimate}</strong> after payment is verified. {state.bookstore.shippingFee > 0 && <>Shipping {formatINR(state.bookstore.shippingFee)}, free on orders over {formatINR(state.bookstore.freeShippingThreshold)}.</>}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" /> No learning subscription needed. Pay by UPI or bank transfer.
              </li>
              <li className="flex items-start gap-2.5">
                <RotateCcw className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" /> Damaged, defective or incorrect copies can be reported within {state.bookstore.returnWindowDays} days of delivery.
              </li>
            </ul>
          </div>

          {editions.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-bold text-fg">Also available as</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {editions.map((e) => (
                  <Link key={e.id} href={`/books/${e.slug}`} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm hover:border-brand-300">
                    <span className="font-semibold text-fg">{[e.language, e.edition].filter(Boolean).join(" · ")}</span>
                    <span className="ml-2 text-slate-500">{formatINR(e.price)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-lg font-extrabold">About this book</h2>
            <p className="mt-2 leading-relaxed text-slate-600">{book.description}</p>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-extrabold">Details</h2>
            <dl className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {specs
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5 text-sm">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className={cn("font-medium text-fg", k === "ISBN" && "font-mono")}>{v}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section className="border-t border-line bg-mist py-12" aria-labelledby="related-heading">
          <div className="container-page">
            <h2 id="related-heading" className="text-2xl font-extrabold">
              Related books
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {related.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
