"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BadgeCheck, BookOpen, CreditCard, PackageCheck, RotateCcw, Search, SlidersHorizontal, Truck, X } from "lucide-react";
import { BookCard } from "@/components/bookstore/book-card";
import { PrimaryPhoto } from "@/components/bookstore/book-visuals";
import { SubjectIcon } from "@/components/course-visuals";
import { Breadcrumbs } from "@/components/page-banner";
import { Eyebrow } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, SkeletonCards } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { Drawer } from "@/components/ui/modal";
import { availableStock } from "@/lib/bookstore";
import { useSession, useSimulatedLoad } from "@/lib/hooks";
import { EXAMS, SUBJECTS } from "@/lib/mock/catalog";
import type { Book, ExamId, SubjectId } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";

const publishedBooks = (books: Book[]) => books.filter((b) => b.status === "published");

function StoreSearch({ initial = "", size = "lg" }: { initial?: string; size?: "md" | "lg" }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/books/catalog${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
      }}
      className={cn("flex w-full items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card", size === "lg" ? "max-w-2xl sm:rounded-full sm:pl-5" : "")}
    >
      <label className="flex flex-1 items-center gap-2.5 px-2">
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
        <span className="sr-only">Search books by title, author or ISBN</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, author or ISBN" className="h-10 w-full bg-transparent text-sm text-fg outline-none placeholder:text-slate-400" />
      </label>
      <button type="submit" className="h-10 shrink-0 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
        Search
      </button>
    </form>
  );
}

function Shelf({ title, subtitle, books, href }: { title: string; subtitle: string; books: Book[]; href: string }) {
  if (!books.length) return null;
  return (
    <section className="container-page py-12" aria-label={title}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">
          View all <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
        {books.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Landing ------------------------------ */

export function BookstoreLanding() {
  const { state } = useSession();
  const books = publishedBooks(state.books);
  const featured = books.filter((b) => b.featured).slice(0, 4);
  const newest = [...books].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  const popular = [...books].sort((a, b) => b.sold - a.sold).slice(0, 4);
  const s = state.bookstore;

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-mist">
        <div className="bg-dots absolute inset-0 opacity-60 [mask-image:linear-gradient(to_left,black,transparent_75%)]" />
        <div className="container-page relative grid items-center gap-10 py-12 lg:grid-cols-[1.2fr_1fr] lg:py-16">
          <div>
            <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Bookstore" }]} />
            <Eyebrow className="mt-5">StudyVerse Bookstore</Eyebrow>
            <h1 className="mt-4 text-4xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl">
              Books for every <span className="text-brand-600 dark:text-brand-400">JEE & MHT-CET</span> chapter
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-500 sm:text-lg">Printed workbooks, solved papers and revision notes, delivered across India. No learning subscription needed to buy.</p>
            <div className="mt-7">
              <StoreSearch />
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <Truck className="size-4 text-brand-600 dark:text-brand-400" /> Free shipping over {formatINR(s.freeShippingThreshold)}
              </li>
              <li className="flex items-center gap-2">
                <CreditCard className="size-4 text-brand-600 dark:text-brand-400" /> Pay by UPI or bank transfer
              </li>
              <li className="flex items-center gap-2">
                <RotateCcw className="size-4 text-brand-600 dark:text-brand-400" /> {s.returnWindowDays}-day returns for damaged books
              </li>
            </ul>
          </div>
          <div className="hidden grid-cols-3 items-end gap-4 lg:grid" aria-hidden>
            {featured.slice(0, 3).map((b, i) => (
              <Link key={b.id} href={`/books/${b.slug}`} tabIndex={-1} className={cn("transition-transform hover:-translate-y-1", i === 1 && "-translate-y-6")}>
                <BookCardCoverOnly book={b} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page grid gap-8 py-12 lg:grid-cols-2" aria-label="Browse">
        <div>
          <h2 className="text-lg font-extrabold">Browse by exam</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {EXAMS.filter((e) => !e.comingSoon).map((e) => {
              const n = books.filter((b) => b.examIds.includes(e.id)).length;
              return (
                <Link key={e.id} href={`/books/catalog?exam=${e.id}`} className="rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-300">
                  <p className="font-bold text-fg">{e.name}</p>
                  <p className="text-xs text-slate-500">{n} books</p>
                </Link>
              );
            })}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-extrabold">Browse by subject</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {SUBJECTS.map((sub) => {
              const n = books.filter((b) => b.subjectIds.includes(sub.id)).length;
              return (
                <Link key={sub.id} href={`/books/catalog?subject=${sub.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-300">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300">
                    <SubjectIcon subject={sub.id} className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-fg">{sub.name}</span>
                    <span className="text-xs text-slate-500">{n} books</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <Shelf title="Featured for this season" subtitle="Hand-picked by the StudyVerse faculty" books={featured} href="/books/catalog?sort=popular" />
      <div className="bg-mist">
        <Shelf title="New arrivals" subtitle="Fresh editions and new titles" books={newest} href="/books/catalog?sort=newest" />
      </div>
      <Shelf title="Popular with aspirants" subtitle="Most ordered books this year" books={popular} href="/books/catalog?sort=popular" />

      <section className="container-page pb-16" aria-labelledby="how-heading">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <h2 id="how-heading" className="text-xl font-extrabold">
            How ordering works
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <BookOpen />, t: "Add books to your cart", d: "Browse freely — log in only when you check out." },
              { icon: <PackageCheck />, t: "Place your order", d: `Stock is reserved for ${s.reservationHours} hours while you pay.` },
              { icon: <CreditCard />, t: "Pay by UPI or bank", d: "Transfer the amount, then submit the transaction reference." },
              { icon: <BadgeCheck />, t: "We verify & dispatch", d: `Track your parcel — typical delivery ${s.deliveryEstimate}.` },
            ].map((step, i) => (
              <li key={step.t} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 dark:bg-brand-400/10 text-brand-700 dark:text-brand-300 [&_svg]:size-5">{step.icon}</span>
                <div>
                  <p className="text-sm font-bold text-fg">
                    {i + 1}. {step.t}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

function BookCardCoverOnly({ book }: { book: Book }) {
  return (
    <div className="drop-shadow-xl">
      <PrimaryPhoto book={book} size="md" />
    </div>
  );
}

/* ------------------------------ Catalog ------------------------------ */

type Sort = "popular" | "newest" | "price-asc" | "price-desc";
type PriceBand = "" | "under300" | "300-600" | "600-900" | "900+";
const PRICE_BANDS: { value: PriceBand; label: string; test: (p: number) => boolean }[] = [
  { value: "", label: "Any price", test: () => true },
  { value: "under300", label: "Under ₹300", test: (p) => p < 300 },
  { value: "300-600", label: "₹300 – ₹600", test: (p) => p >= 300 && p < 600 },
  { value: "600-900", label: "₹600 – ₹900", test: (p) => p >= 600 && p < 900 },
  { value: "900+", label: "₹900 and above", test: (p) => p >= 900 },
];

export function BookCatalog() {
  const params = useSearchParams();
  return (
    <Catalog
      key={params.toString()}
      initialQ={params.get("q") ?? ""}
      initialExam={(params.get("exam") as ExamId) ?? ""}
      initialSubject={(params.get("subject") as SubjectId) ?? ""}
      initialSort={(params.get("sort") as Sort) ?? "popular"}
    />
  );
}

function Catalog({ initialQ, initialExam, initialSubject, initialSort }: { initialQ: string; initialExam: ExamId | ""; initialSubject: SubjectId | ""; initialSort: Sort }) {
  const { state, now } = useSession();
  const [q, setQ] = useState(initialQ);
  const [exam, setExam] = useState<ExamId | "">(initialExam);
  const [subject, setSubject] = useState<SubjectId | "">(initialSubject);
  const [price, setPrice] = useState<PriceBand>("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [publishers, setPublishers] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>(["popular", "newest", "price-asc", "price-desc"].includes(initialSort) ? initialSort : "popular");
  const [open, setOpen] = useState(false);
  const load = useSimulatedLoad("books");

  const all = publishedBooks(state.books);
  const allPublishers = [...new Set(all.map((b) => b.publisher ?? "Not listed"))].sort();

  const results = (() => {
    const needle = q.trim().toLowerCase().replace(/-/g, "");
    const band = PRICE_BANDS.find((b) => b.value === price)!;
    return all
      .filter((b) => {
        if (needle && !`${b.title} ${b.author ?? ""} ${(b.isbn ?? "").replace(/-/g, "")}`.toLowerCase().includes(needle)) return false;
        if (exam && !b.examIds.includes(exam)) return false;
        if (subject && !b.subjectIds.includes(subject)) return false;
        if (!band.test(b.price)) return false;
        if (inStockOnly && availableStock(b, state.bookOrders, now) <= 0) return false;
        if (publishers.length && !publishers.includes(b.publisher ?? "Not listed")) return false;
        return true;
      })
      .sort((a, b) => (sort === "newest" ? b.createdAt - a.createdAt : sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : b.sold - a.sold));
  })();

  const activeCount = [exam, subject, price, inStockOnly ? "y" : "", ...publishers].filter(Boolean).length;
  const clear = () => {
    setQ("");
    setExam("");
    setSubject("");
    setPrice("");
    setInStockOnly(false);
    setPublishers([]);
  };

  const radio = (name: string, value: string, current: string, set: (v: string) => void, label: string) => (
    <label key={value || "any"} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
      <input type="radio" name={name} checked={current === value} onChange={() => set(value)} className="size-4 accent-brand-600" />
      <span className={cn("font-medium", current === value ? "text-fg" : "text-slate-600")}>{label}</span>
    </label>
  );

  const filters = (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Exam</legend>
        {radio("exam", "", exam, (v) => setExam(v as ExamId | ""), "All exams")}
        {EXAMS.filter((e) => !e.comingSoon).map((e) => radio("exam", e.id, exam, (v) => setExam(v as ExamId), e.name))}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Subject</legend>
        {radio("subject", "", subject, (v) => setSubject(v as SubjectId | ""), "All subjects")}
        {SUBJECTS.map((s) => radio("subject", s.id, subject, (v) => setSubject(v as SubjectId), s.name))}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Price</legend>
        {PRICE_BANDS.map((b) => radio("price", b.value, price, (v) => setPrice(v as PriceBand), b.label))}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Availability</legend>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="size-4 rounded accent-brand-600" />
          <span className="font-medium text-slate-600">Hide out-of-stock books</span>
        </label>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Publisher</legend>
        {allPublishers.map((p) => (
          <label key={p} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
            <input
              type="checkbox"
              checked={publishers.includes(p)}
              onChange={() => setPublishers((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))}
              className="size-4 rounded accent-brand-600"
            />
            <span className="font-medium text-slate-600">{p}</span>
          </label>
        ))}
      </fieldset>
      {activeCount > 0 && (
        <button type="button" onClick={clear} className="text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <>
      <section className="border-b border-line bg-mist">
        <div className="container-page py-8">
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/books", label: "Bookstore" }, { label: "All books" }]} />
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">All books</h1>
          <p className="mt-1 text-slate-500">Each edition and language is listed separately with its own price and stock.</p>
        </div>
      </section>
      <div className="container-page grid grid-cols-1 gap-8 py-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 rounded-2xl border border-line bg-surface p-5 shadow-card">
            <p className="mb-4 flex items-center gap-2 text-sm font-bold text-fg">
              <SlidersHorizontal className="size-4" /> Filters
            </p>
            {filters}
          </div>
        </aside>
        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search books</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Title, author or ISBN"
                className="h-11 w-full rounded-xl border border-line-strong bg-surface pr-10 pl-10 text-sm text-fg shadow-xs outline-none focus:border-brand-500 focus:shadow-ring"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-fg" aria-label="Clear search">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" className="h-11 lg:hidden" onClick={() => setOpen(true)}>
                <SlidersHorizontal /> Filters {activeCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] text-white">{activeCount}</span>}
              </Button>
              <div className="w-48">
                <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort books" className="h-11 rounded-xl">
                  <option value="popular">Most popular</option>
                  <option value="newest">Newest arrivals</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </Select>
              </div>
            </div>
          </div>
          <p className="my-5 text-sm text-slate-500" aria-live="polite">
            {load.status === "success" ? (
              <>
                <strong className="text-fg">{results.length}</strong> book{results.length === 1 ? "" : "s"}
                {q && <> matching “{q}”</>}
              </>
            ) : (
              "Loading books…"
            )}
          </p>
          {load.status === "loading" ? (
            <SkeletonCards count={6} />
          ) : load.status === "error" ? (
            <ErrorState title="Couldn't load books" onRetry={load.retry} />
          ) : results.length === 0 ? (
            <EmptyState icon={<BookOpen />} title="No books match" description="Try another search term, or clear the filters." action={<Button variant="outline" onClick={clear}>Clear filters</Button>} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
              {results.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          )}
        </div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Filter books" side="left" width="max-w-sm" footer={<Button block onClick={() => setOpen(false)}>Show {results.length} books</Button>}>
        <div className="p-5">{filters}</div>
      </Drawer>
    </>
  );
}

