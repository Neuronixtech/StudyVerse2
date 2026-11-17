"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { availableStock, discountPercent, stockState } from "@/lib/bookstore";
import { addToCart, cartKey } from "@/lib/bookstore-store";
import { useSession } from "@/lib/hooks";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { toast } from "../ui/toast";
import { BookMetaChips, PriceTag, PrimaryPhoto, StockBadge } from "./book-visuals";

export function BookCard({ book }: { book: Book }) {
  const { state, learner, now } = useSession();
  const available = availableStock(book, state.bookOrders, now);
  const st = stockState(available, state.bookstore);
  const off = discountPercent(book.mrp, book.price);
  const key = cartKey(learner?.id);
  const inCart = (state.carts[key] ?? []).find((c) => c.bookId === book.id)?.qty ?? 0;

  return (
    <article className="group relative flex flex-col rounded-2xl border border-line bg-surface p-3 shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-1 hover:border-brand-200 dark:hover:border-brand-400/30 hover:shadow-lift">
      <div className="relative grid place-items-center rounded-xl bg-mist px-6 py-5">
        <PrimaryPhoto book={book} className={cn("w-full max-w-36 transition-transform duration-300 group-hover:scale-[1.03]", st === "out" && "opacity-60 grayscale-[40%]")} />
        {off > 0 && <span className="absolute top-2.5 left-2.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white">−{off}%</span>}
        {st === "out" && <span className="absolute inset-x-3 bottom-3 rounded-lg bg-ink/85 py-1 text-center text-xs font-bold text-white">Out of Stock</span>}
      </div>
      <div className="flex flex-1 flex-col px-1.5 pt-3.5">
        <BookMetaChips book={book} />
        <h3 className="mt-1 line-clamp-2 text-[15px] leading-snug font-bold text-fg">
          <Link href={`/books/${book.slug}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
            {book.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {book.author ?? "Author not listed"}
          {book.language && book.language !== "English" ? ` · ${book.language}` : ""}
        </p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <PriceTag mrp={book.mrp} price={book.price} size="sm" />
        </div>
        <div className="mt-2">
          <StockBadge state={st} available={available} size="xs" />
        </div>
        <div className="relative z-10 mt-auto pt-3">
          <Button
            block
            size="sm"
            variant={inCart ? "subtle" : "primary"}
            disabled={st === "out" || inCart >= available}
            onClick={() => {
              addToCart(key, book.id, 1);
              toast({ title: "Added to cart", description: book.title, tone: "success" });
            }}
            aria-label={st === "out" ? `${book.title} is out of stock` : `Add ${book.title} to cart`}
          >
            <ShoppingCart /> {st === "out" ? "Out of stock" : inCart ? `In cart (${inCart}) · Add another` : "Add to cart"}
          </Button>
        </div>
      </div>
    </article>
  );
}
