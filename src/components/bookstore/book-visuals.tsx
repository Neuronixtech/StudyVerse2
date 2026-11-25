import Image from "next/image";
import Link from "next/link";
import { BookOpen, ImageIcon } from "lucide-react";
import { discountPercent, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type StockState } from "@/lib/bookstore";
import { examShort, subjectName } from "@/lib/mock/catalog";
import type { Book, BookPhoto, OrderStatus, ThumbTheme } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";
import { THEMES, SubjectIcon } from "../course-visuals";
import { Badge } from "../ui/badge";

type CoverBook = Pick<Book, "title" | "author" | "publisher" | "examIds" | "subjectIds" | "theme" | "isbn" | "edition" | "language">;

/** Illustrated front cover — stands in for a product photo in the prototype */
export function BookCover({ book, size = "md", className }: { book: CoverBook; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const subject = book.subjectIds.length === 1 ? book.subjectIds[0] : "mixed";
  const tiny = size === "xs" || size === "sm";
  return (
    <div
      className={cn(
        "relative isolate aspect-[3/4] overflow-hidden rounded-l-[3px] rounded-r-lg bg-linear-to-br text-white shadow-[4px_6px_14px_-6px_rgb(0_0_0/0.45)]",
        THEMES[book.theme].bg,
        className,
      )}
      role="img"
      aria-label={`${book.title} cover`}
    >
      <div className="bg-grid-faint absolute inset-0 -z-10 opacity-50" />
      <div className={cn("absolute -right-8 -bottom-10 -z-10 size-32 rounded-full", THEMES[book.theme].accent)} />
      <div className="absolute inset-y-0 left-0 w-[7%] bg-black/20" />
      <div className="absolute inset-y-0 left-[7%] w-px bg-white/25" />
      {tiny ? (
        <div className="flex h-full items-center justify-center pl-[7%]">
          <SubjectIcon subject={subject} className={size === "xs" ? "size-4" : "size-6"} />
        </div>
      ) : (
        <div className="flex h-full flex-col pt-[9%] pr-[8%] pb-[7%] pl-[14%]">
          <p className={cn("font-bold tracking-widest text-white/80 uppercase", size === "lg" ? "text-xs" : "text-[9px]")}>
            {book.examIds.map(examShort).join(" · ")}
          </p>
          <div className={cn("mt-auto mb-auto grid place-items-start", size === "lg" ? "gap-4" : "gap-2")}>
            <span className={cn("grid place-items-center rounded-lg bg-white/15 ring-1 ring-white/30", size === "lg" ? "size-12" : "size-8")}>
              <SubjectIcon subject={subject} className={size === "lg" ? "size-6" : "size-4"} />
            </span>
            <p className={cn("leading-tight font-extrabold text-balance", size === "lg" ? "line-clamp-5 text-2xl" : "line-clamp-4 text-[13px]")}>{book.title}</p>
            {book.language && book.language !== "English" && (
              <span className={cn("rounded bg-surface/90 font-bold text-[#0d1b2a]", size === "lg" ? "px-2 py-0.5 text-xs" : "px-1.5 text-[9px]")}>{book.language}</span>
            )}
          </div>
          <div className={cn("border-t border-white/30 pt-2", size === "lg" ? "text-sm" : "text-[10px]")}>
            {book.author && <p className="truncate font-semibold">{book.author}</p>}
            <p className="truncate text-white/70">{book.publisher ?? "Independent"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const CONTENTS: Record<string, string[]> = {
  physics: ["Units & Dimensions", "Kinematics", "Laws of Motion", "Work, Energy & Power", "Rotational Motion", "Gravitation", "Electrostatics"],
  chemistry: ["Mole Concept", "Atomic Structure", "Chemical Bonding", "Thermodynamics", "Equilibrium", "Organic Basics", "p-Block Elements"],
  mathematics: ["Sets & Functions", "Quadratic Equations", "Sequences & Series", "Limits", "Differentiation", "Integration", "Coordinate Geometry"],
  mixed: ["Physics: Mechanics", "Physics: Electricity", "Chemistry: Physical", "Chemistry: Organic", "Chemistry: Inorganic", "Maths: Algebra", "Maths: Calculus"],
};

/** Renders one gallery photo. Paper pages use fixed colours so they stay "paper" in dark mode. */
export function BookPhotoView({ book, photo, size = "md", className }: { book: CoverBook; photo: BookPhoto; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const frame = cn("relative aspect-[3/4] overflow-hidden rounded-lg", className);
  if (photo.kind === "cover") return <BookCover book={book} size={size} className={className} />;
  if (photo.kind === "upload") {
    return photo.dataUrl ? (
      <div className={cn(frame, "bg-slate-100")}>
        <Image src={photo.dataUrl} alt={photo.label} fill unoptimized className="object-cover" sizes="400px" />
      </div>
    ) : (
      <div className={cn(frame, "grid place-items-center border border-dashed border-line-strong bg-slate-50 p-3 text-center")}>
        <div>
          <ImageIcon className="mx-auto size-6 text-slate-400" />
          {size !== "xs" && size !== "sm" && <p className="mt-1 truncate text-xs text-slate-500">{photo.fileName ?? photo.label}</p>}
        </div>
      </div>
    );
  }
  const tiny = size === "xs" || size === "sm";
  if (photo.kind === "back") {
    return (
      <div className={cn(frame, "bg-linear-to-br text-white", THEMES[book.theme].bg)} role="img" aria-label={`${book.title} back cover`}>
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative flex h-full flex-col p-[10%]">
          {!tiny && <p className={cn("font-bold", size === "lg" ? "text-base" : "text-[11px]")}>About this book</p>}
          <div className="mt-3 space-y-1.5">
            {[100, 92, 96, 70, 88, 60].map((w, i) => (
              <div key={i} className="h-1 rounded bg-white/40" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="mt-auto self-end rounded bg-white p-1.5">
            <div className="flex h-6 items-end gap-px">
              {Array.from({ length: 22 }, (_, i) => (
                <span key={i} className="bg-black" style={{ width: i % 3 === 0 ? 2 : 1, height: `${70 + ((i * 17) % 30)}%` }} />
              ))}
            </div>
            {!tiny && <p className="mt-0.5 text-center font-mono text-[7px] text-black">{book.isbn ?? "ISBN n/a"}</p>}
          </div>
        </div>
      </div>
    );
  }
  const subject = book.subjectIds.length === 1 ? book.subjectIds[0] : "mixed";
  if (photo.kind === "contents") {
    return (
      <div className={cn(frame, "bg-[#fdfcf7] text-[#1e293b] ring-1 ring-black/10")} role="img" aria-label={`${book.title} contents page`}>
        <div className="flex h-full flex-col p-[10%]">
          <p className={cn("font-extrabold", size === "lg" ? "text-xl" : "text-xs")}>Contents</p>
          {!tiny && (
            <ol className={cn("mt-3 space-y-1.5", size === "lg" ? "text-sm" : "text-[9px]")}>
              {CONTENTS[subject].map((c, i) => (
                <li key={c} className="flex items-baseline gap-1">
                  <span className="font-bold text-[#0e8174]">{i + 1}</span>
                  <span className="truncate">{c}</span>
                  <span className="flex-1 border-b border-dotted border-[#94a3b8]" />
                  <span className="text-[#64748b]">{12 + i * 38}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className={cn(frame, "bg-[#fdfcf7] text-[#1e293b] ring-1 ring-black/10")} role="img" aria-label={`${book.title} sample page`}>
      <div className="flex h-full flex-col p-[10%]">
        <p className={cn("font-bold text-[#0e8174]", size === "lg" ? "text-sm" : "text-[9px]")}>Worked example 4.2</p>
        <div className="mt-2 space-y-1.5">
          {[100, 94, 98, 76].map((w, i) => (
            <div key={i} className="h-1 rounded bg-[#cbd5e1]" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className={cn("my-3 rounded border border-[#a9e6da] bg-[#eefbf8] p-2 text-center font-mono", size === "lg" ? "text-base" : "text-[9px]")}>
          {subject === "chemistry" ? "pH = −log[H⁺]" : subject === "mathematics" ? "∫₀² 3x² dx = 8" : "v² = u² + 2as"}
        </div>
        <div className="space-y-1.5">
          {[90, 100, 84, 96, 58].map((w, i) => (
            <div key={i} className="h-1 rounded bg-[#cbd5e1]" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PrimaryPhoto({ book, size = "md", className }: { book: Book; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const photo = book.photos.find((p) => p.id === book.primaryPhotoId) ?? book.photos[0];
  if (!photo) return <BookCover book={book} size={size} className={className} />;
  return <BookPhotoView book={book} photo={photo} size={size} className={className} />;
}

/** Small cover for order line items (uses the price snapshot's theme) */
export function SnapshotCover({ title, theme, className }: { title: string; theme: ThumbTheme; className?: string }) {
  return (
    <div className={cn("relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-l-[2px] rounded-r-md bg-linear-to-br shadow-sm", THEMES[theme].bg, className)} role="img" aria-label={`${title} cover`}>
      <div className="absolute inset-y-0 left-0 w-[8%] bg-black/20" />
      <BookOpen className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-white/80" />
    </div>
  );
}

export function PriceTag({ mrp, price, size = "md" }: { mrp: number; price: number; size?: "sm" | "md" | "lg" }) {
  const off = discountPercent(mrp, price);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn("font-extrabold text-fg", size === "lg" ? "text-3xl" : size === "md" ? "text-lg" : "text-base")}>{formatINR(price)}</span>
      {off > 0 && (
        <>
          <span className={cn("text-slate-400 line-through", size === "lg" ? "text-base" : "text-xs")}>
            <span className="sr-only">MRP </span>
            {formatINR(mrp)}
          </span>
          <span className={cn("font-bold text-emerald-600 dark:text-emerald-400", size === "lg" ? "text-base" : "text-xs")}>{off}% off</span>
        </>
      )}
      {off === 0 && size === "lg" && <span className="text-sm text-slate-500">MRP — no discount</span>}
    </div>
  );
}

export function StockBadge({ state, available, size = "sm" }: { state: StockState; available: number; size?: "xs" | "sm" }) {
  if (state === "out") return <Badge tone="red" size={size} dot>Out of Stock</Badge>;
  if (state === "low") return <Badge tone="amber" size={size} dot>Only {available} left</Badge>;
  return <Badge tone="green" size={size} dot>In stock</Badge>;
}

export function OrderStatusBadge({ status, size = "sm" }: { status: OrderStatus; size?: "xs" | "sm" }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]} size={size} dot>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  );
}

export function BookMetaChips({ book }: { book: Pick<Book, "examIds" | "subjectIds"> }) {
  return (
    <p className="truncate text-xs font-semibold text-brand-700 dark:text-brand-300">
      {book.examIds.map(examShort).join(" · ")}
      <span className="text-slate-400"> · {book.subjectIds.map(subjectName).join(", ")}</span>
    </p>
  );
}

export function BookTitleLink({ book, className }: { book: Pick<Book, "slug" | "title">; className?: string }) {
  return (
    <Link href={`/books/${book.slug}`} className={cn("font-bold text-fg hover:text-brand-700 dark:hover:text-brand-300", className)}>
      {book.title}
    </Link>
  );
}
