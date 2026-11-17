"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  Boxes,
  ExternalLink,
  Eye,
  ImagePlus,
  Library,
  Lock,
  MoreHorizontal,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import { BookPhotoView, PrimaryPhoto, StockBadge } from "@/components/bookstore/book-visuals";
import { THEMES } from "@/components/course-visuals";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Callout, Card, CardHeader, EmptyState, ErrorState, PageHeader, SimulatedNote, Skeleton, StatCard } from "@/components/ui/feedback";
import { ChipGroup, Field, Input, Segmented, Switch, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { availableStock, discountPercent, hasAnyBookPermission, hasBookPermission, reservedQty, stockState } from "@/lib/bookstore";
import { adjustStock, createBook, saveBook, setBookStatus } from "@/lib/bookstore-store";
import { useSession, useSimulatedLoad } from "@/lib/hooks";
import { EXAMS, SUBJECTS } from "@/lib/mock/catalog";
import type { Book, BookPhoto, BookStatus, ExamId, SubjectId, ThumbTheme } from "@/lib/types";
import { cn, formatDateTime, formatINR, moveItem, relativeTime, slugify, uid } from "@/lib/utils";
import { Restricted } from "./admin-shell";

const STATUS_TONE: Record<BookStatus, Tone> = { published: "green", draft: "amber", archived: "slate" };
const STATUS_LABEL: Record<BookStatus, string> = { published: "Published", draft: "Draft", archived: "Archived" };

/** Downscales an uploaded image so it fits comfortably in browser storage (prototype only) */
async function downscale(file: File, max = 480): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Unreadable image"));
      img.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------ Stock dialog ------------------------------ */

export function StockDialog({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const { state, admin, now } = useSession();
  const [kind, setKind] = useState<"added" | "damaged" | "correction">("added");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ qty?: string; reason?: string }>({});
  if (!book || !admin) return null;
  const reserved = reservedQty(state.bookOrders, book.id, now);
  const n = Number(qty);
  const delta = kind === "added" ? n : kind === "damaged" ? -n : n - book.stock;
  const after = book.stock + (Number.isFinite(delta) ? delta : 0);

  const submit = () => {
    const errs: typeof errors = {};
    if (qty === "" || !Number.isInteger(n) || n < 0 || (kind !== "correction" && n === 0)) errs.qty = kind === "correction" ? "Enter the counted quantity" : "Enter a quantity above zero";
    else if (kind === "damaged" && n > book.stock) errs.qty = `Only ${book.stock} on hand`;
    else if (kind === "correction" && delta === 0) errs.qty = "Counted quantity matches the system — nothing to correct";
    if (reason.trim().length < 4) errs.reason = "A reason is required for every adjustment";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    adjustStock(book.id, delta, kind, reason.trim(), admin.id);
    toast({ title: "Stock updated", description: `${book.title}: ${book.stock} → ${after}`, simulated: true });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Adjust stock"
      description={book.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save adjustment</Button>
        </>
      }
    >
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          ["On hand", book.stock],
          ["Reserved", reserved],
          ["Available", Math.max(0, book.stock - reserved)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="text-xl font-extrabold text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 space-y-4">
        <Segmented
          label="Adjustment type"
          className="w-full"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setErrors({});
          }}
          options={[
            { value: "added", label: <span className="inline-flex items-center gap-1.5"><PackagePlus className="size-4" /> Add stock</span> },
            { value: "damaged", label: <span className="inline-flex items-center gap-1.5"><PackageMinus className="size-4" /> Damaged</span> },
            { value: "correction", label: "Correct count" },
          ]}
        />
        <Field label={kind === "correction" ? "Counted quantity on hand" : kind === "damaged" ? "Copies to remove" : "Copies received"} error={errors.qty} required hint={qty !== "" && Number.isFinite(delta) ? `On hand after: ${after} (${delta >= 0 ? "+" : ""}${delta})` : undefined}>
          {(p) => <Input {...p} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />}
        </Field>
        <Field label="Reason" error={errors.reason} required>
          {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === "added" ? "e.g. Printer consignment #PR-2231" : kind === "damaged" ? "e.g. Water damage in storage" : "e.g. Monthly physical count"} />}
        </Field>
        {after < reserved && <Callout tone="warning">On-hand stock will be lower than reserved quantity ({reserved}). Affected orders may need to be put on hold.</Callout>}
        <SimulatedNote>Every adjustment is recorded with who made it and when.</SimulatedNote>
      </div>
    </Modal>
  );
}

/* ------------------------------ Book list ------------------------------ */

type ListTab = "all" | BookStatus | "low" | "out";

export function BooksAdminPage() {
  const { state, admin, now } = useSession();
  const [tab, setTab] = useState<ListTab>("all");
  const [q, setQ] = useState("");
  const [stockBook, setStockBook] = useState<Book | null>(null);
  const [archiving, setArchiving] = useState<Book | null>(null);
  const load = useSimulatedLoad("admin-books");
  const s = state.bookstore;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/-/g, "");
    return state.books
      .map((b) => ({ b, reserved: reservedQty(state.bookOrders, b.id, now), available: availableStock(b, state.bookOrders, now) }))
      .filter(({ b, available }) => {
        if (needle && !`${b.title} ${b.author ?? ""} ${(b.isbn ?? "").replace(/-/g, "")} ${b.publisher ?? ""}`.toLowerCase().includes(needle)) return false;
        if (tab === "low") return b.status === "published" && available > 0 && available <= s.lowStockThreshold;
        if (tab === "out") return b.status === "published" && available <= 0;
        return tab === "all" || b.status === tab;
      })
      .sort((a, b) => b.b.updatedAt - a.b.updatedAt);
  }, [state.books, state.bookOrders, now, q, tab, s.lowStockThreshold]);

  if (!admin || !hasAnyBookPermission(admin, ["books.edit", "books.photos", "inventory.adjust", "pricing.change"])) return <Restricted what="bookstore books" />;
  const canEdit = hasBookPermission(admin, "books.edit");
  const canStock = hasBookPermission(admin, "inventory.adjust");
  const published = state.books.filter((b) => b.status === "published");
  const lowCount = published.filter((b) => {
    const a = availableStock(b, state.bookOrders, now);
    return a > 0 && a <= s.lowStockThreshold;
  }).length;
  const outCount = published.filter((b) => availableStock(b, state.bookOrders, now) <= 0).length;
  const count = (t: ListTab) => (t === "all" ? state.books.length : t === "low" ? lowCount : t === "out" ? outCount : state.books.filter((b) => b.status === t).length);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Books & inventory"
        description={`Each edition/language is its own listing with its own price and stock. Low-stock threshold: ${s.lowStockThreshold} copies.`}
        actions={
          canEdit ? (
            <ButtonLink href="/admin/bookstore/books/new">
              <Plus /> Add book
            </ButtonLink>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Published listings" value={published.length} icon={<Library />} />
        <StatCard label="Units on hand" value={state.books.filter((b) => b.status !== "archived").reduce((a, b) => a + b.stock, 0)} icon={<Boxes />} tone="sky" />
        <StatCard label="Low stock" value={lowCount} icon={<PackageMinus />} tone="amber" hint={`≤ ${s.lowStockThreshold} available`} />
        <StatCard label="Out of stock" value={outCount} icon={<PackageMinus />} tone="rose" hint="Visible, purchase disabled" />
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            label="Book filter"
            variant="pill"
            value={tab}
            onChange={setTab}
            items={[
              { value: "all", label: "All", count: count("all") },
              { value: "published", label: "Published", count: count("published") },
              { value: "draft", label: "Draft", count: count("draft") },
              { value: "archived", label: "Archived", count: count("archived") },
              { value: "low", label: "Low stock", count: count("low") },
              { value: "out", label: "Out of stock", count: count("out") },
            ]}
          />
          <label className="relative xl:w-72">
            <span className="sr-only">Search books</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, author, ISBN, publisher" className="h-10 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-sm text-fg outline-none focus:border-brand-500 focus:shadow-ring" />
          </label>
        </div>
        {load.status === "loading" ? (
          <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : load.status === "error" ? (
          <div className="p-4"><ErrorState onRetry={load.retry} /></div>
        ) : rows.length === 0 ? (
          <div className="p-4"><EmptyState className="border-0" icon={<Library />} title="No books here" description="Try another filter or search." /></div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ b, reserved, available }) => {
              const st = stockState(available, s);
              return (
                <li key={b.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                  <Link href={`/admin/bookstore/books/${b.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <PrimaryPhoto book={b} size="xs" className="w-12 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-fg hover:text-brand-700 dark:hover:text-brand-300">{b.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[b.author, b.language, b.edition].filter(Boolean).join(" · ") || "No author listed"}
                        {b.isbn && <span className="font-mono"> · {b.isbn}</span>}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[b.status]} size="xs" dot>{STATUS_LABEL[b.status]}</Badge>
                        {b.status === "published" && <StockBadge state={st} available={available} size="xs" />}
                      </div>
                    </div>
                  </Link>
                  <div className="grid grid-cols-4 gap-3 text-center text-xs md:w-80">
                    <div><p className="text-slate-500">Price</p><p className="font-bold text-fg">{formatINR(b.price)}</p>{b.price < b.mrp && <p className="text-[10px] text-slate-400 line-through">{formatINR(b.mrp)}</p>}</div>
                    <div><p className="text-slate-500">On hand</p><p className="font-bold text-fg">{b.stock}</p></div>
                    <div><p className="text-slate-500">Reserved</p><p className="font-bold text-fg">{reserved}</p></div>
                    <div><p className="text-slate-500">Sold</p><p className="font-bold text-fg">{b.sold}</p></div>
                  </div>
                  <div className="flex items-center gap-1 md:justify-end">
                    {canStock && (
                      <Button size="sm" variant="secondary" onClick={() => setStockBook(b)}>
                        <Boxes /> Stock
                      </Button>
                    )}
                    <ButtonLink href={`/admin/bookstore/books/${b.id}`} size="sm" variant="secondary">
                      <Pencil /> Edit
                    </ButtonLink>
                    {canEdit && (
                      <Menu
                        label={`Actions for ${b.title}`}
                        trigger={(p) => (
                          <IconButton label="More actions" size="sm" onClick={p.toggle} aria-expanded={p["aria-expanded"]} aria-haspopup="menu">
                            <MoreHorizontal />
                          </IconButton>
                        )}
                      >
                        {(close) => (
                          <>
                            {b.status !== "published" && b.status !== "archived" && (
                              <MenuItem icon={<Eye />} onSelect={() => { close(); setBookStatus(b.id, "published", admin.id); toast({ title: "Book published", simulated: true }); }}>
                                Publish
                              </MenuItem>
                            )}
                            {b.status === "published" && (
                              <MenuItem icon={<ExternalLink />} onSelect={() => { close(); window.open(`/books/${b.slug}`, "_blank"); }}>
                                View in storefront
                              </MenuItem>
                            )}
                            {b.status === "archived" ? (
                              <MenuItem icon={<ArchiveRestore />} onSelect={() => { close(); setBookStatus(b.id, "draft", admin.id); toast({ title: "Restored as draft", simulated: true }); }}>
                                Restore as draft
                              </MenuItem>
                            ) : (
                              <MenuItem icon={<Archive />} onSelect={() => { close(); setArchiving(b); }}>
                                Archive
                              </MenuItem>
                            )}
                          </>
                        )}
                      </Menu>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {stockBook && <StockDialog key={stockBook.id} book={state.books.find((b) => b.id === stockBook.id) ?? null} onClose={() => setStockBook(null)} />}
      <ConfirmDialog
        open={!!archiving}
        onClose={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving) setBookStatus(archiving.id, "archived", admin.id);
          toast({ title: "Book archived", description: "Removed from the storefront. Past orders are unaffected.", simulated: true });
          setArchiving(null);
        }}
        title={`Archive “${archiving?.title}”?`}
        description="It will disappear from the storefront and carts can no longer check it out. Historical orders keep their records."
        confirmLabel="Archive"
      />
    </div>
  );
}

/* ------------------------------ Book form ------------------------------ */

type Draft = Omit<Book, "id" | "createdAt" | "updatedAt" | "sold">;

function emptyDraft(): Draft {
  // Deterministic id: this runs during render/prerender (photo ids only need to be unique within a book)
  const coverId = "ph-cover";
  return {
    slug: "", title: "", author: "", publisher: "", isbn: "", examIds: [], subjectIds: [], description: "", language: "English", edition: "", format: "Paperback",
    pages: undefined, mrp: 0, price: 0, stock: 0, status: "draft", theme: "teal", photos: [{ id: coverId, kind: "cover", label: "Front cover" }], primaryPhotoId: coverId, featured: false,
  };
}

function validateDraft(d: Draft, books: Book[], selfId?: string) {
  const errs: Record<string, string> = {};
  if (d.title.trim().length < 3) errs.title = "Title is required";
  if (d.isbn && !/^(97[89])?[\d-]{9,17}[\dX]$/.test(d.isbn.replace(/\s/g, ""))) errs.isbn = "Enter a valid ISBN-10 or ISBN-13 (or leave blank)";
  if (!Number.isFinite(d.mrp) || d.mrp <= 0) errs.mrp = "MRP is required";
  if (!Number.isFinite(d.price) || d.price <= 0) errs.price = "Selling price is required";
  else if (d.price > d.mrp) errs.price = "Selling price can't exceed MRP";
  if (!Number.isInteger(d.stock) || d.stock < 0) errs.stock = "Enter stock as a whole number";
  const slug = slugify(d.slug || d.title);
  if (books.some((b) => b.slug === slug && b.id !== selfId)) errs.title = "Another listing uses this title/URL — add the edition or language to the title";
  if (d.photos.length === 0) errs.photos = "Add at least one photo";
  return errs;
}

function NumberField({ label, value, onChange, error, required, disabled, hint, showZero }: { label: string; value: number | undefined; onChange: (n: number) => void; error?: string; required?: boolean; disabled?: boolean; hint?: string; showZero?: boolean }) {
  const display = value === undefined || Number.isNaN(value) || (value === 0 && !showZero) ? "" : String(value);
  return (
    <Field label={label} error={error} required={required} hint={hint}>
      {(p) => <Input {...p} inputMode="numeric" disabled={disabled} value={display} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value.replace(/\D/g, "")))} />}
    </Field>
  );
}

function DetailsFields({ d, set, errors, canPrice, isNew }: { d: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void; errors: Record<string, string>; canPrice: boolean; isNew: boolean }) {
  const off = discountPercent(d.mrp || 0, d.price || 0);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="Book information" description="Author, publisher, ISBN, language and edition may be left blank if unavailable." />
        <div className="space-y-4 p-5">
          <Field label="Title" error={errors.title} required hint={`Storefront URL: /books/${slugify(d.slug || d.title) || "…"}`}>
            {(p) => <Input {...p} value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Thermodynamics Workbook (Hindi)" />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Author">{(p) => <Input {...p} value={d.author ?? ""} onChange={(e) => set("author", e.target.value)} />}</Field>
            <Field label="Publisher">{(p) => <Input {...p} value={d.publisher ?? ""} onChange={(e) => set("publisher", e.target.value)} />}</Field>
            <Field label="ISBN" error={errors.isbn}>{(p) => <Input {...p} value={d.isbn ?? ""} onChange={(e) => set("isbn", e.target.value)} className="font-mono" placeholder="978-93-…" />}</Field>
            <Field label="Language">{(p) => <Input {...p} value={d.language ?? ""} onChange={(e) => set("language", e.target.value)} />}</Field>
            <Field label="Edition">{(p) => <Input {...p} value={d.edition ?? ""} onChange={(e) => set("edition", e.target.value)} placeholder="e.g. 2nd edition" />}</Field>
            <NumberField label="Pages" value={d.pages} onChange={(n) => set("pages", Number.isFinite(n) && n > 0 ? n : undefined)} />
          </div>
          <Field label="Description">{(p) => <Textarea {...p} rows={5} value={d.description} onChange={(e) => set("description", e.target.value)} />}</Field>
        </div>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Pricing" action={!canPrice ? <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"><Lock className="size-3" /> Needs “Change prices”</span> : undefined} />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="MRP (₹)" value={d.mrp} onChange={(n) => set("mrp", n)} error={errors.mrp} required disabled={!canPrice && !isNew} />
              <NumberField label="Selling price (₹)" value={d.price} onChange={(n) => set("price", n)} error={errors.price} required disabled={!canPrice && !isNew} />
            </div>
            <p className="text-xs text-slate-500">{off > 0 ? `Shown as ${off}% off.` : "No discount shown."} Price changes apply to new orders only — existing orders keep their price snapshot.</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Classification" />
          <div className="space-y-4 p-5">
            <ChipGroup label="Exam category" value={d.examIds} onChange={(v) => set("examIds", v as ExamId[])} options={EXAMS.filter((e) => !e.comingSoon).map((e) => ({ value: e.id, label: e.short }))} />
            <ChipGroup label="Subject" value={d.subjectIds} onChange={(v) => set("subjectIds", v as SubjectId[])} options={SUBJECTS.map((x) => ({ value: x.id, label: x.name }))} />
            <Switch checked={d.featured} onChange={(v) => set("featured", v)} label="Feature in storefront" description="Shows in “Featured for this season”." />
          </div>
        </Card>
        <Card className="p-5">
          <p className="mb-2 text-sm font-semibold text-fg">Cover style</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(THEMES) as ThumbTheme[]).map((t) => (
              <button key={t} type="button" aria-pressed={d.theme === t} aria-label={`${THEMES[t].label} cover`} onClick={() => set("theme", t)} className={cn("size-9 rounded-lg bg-linear-to-br ring-2 ring-offset-2 ring-offset-surface", THEMES[t].bg, d.theme === t ? "ring-brand-500" : "ring-transparent")} />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Used for the illustrated cover when no photo is uploaded.</p>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Create book ------------------------------ */

export function BookCreatePage() {
  const router = useRouter();
  const { state, admin } = useSession();
  const [d, setD] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!admin || !hasBookPermission(admin, "books.edit")) return <Restricted what="adding books" />;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const submit = (status: BookStatus) => {
    const errs = validateDraft(d, state.books);
    setErrors(errs);
    if (Object.keys(errs).length) return toast({ title: "Check the highlighted fields", tone: "error" });
    const clean: Draft = { ...d, status, slug: slugify(d.slug || d.title), title: d.title.trim(), author: d.author?.trim() || undefined, publisher: d.publisher?.trim() || undefined, isbn: d.isbn?.trim() || undefined, language: d.language?.trim() || undefined, edition: d.edition?.trim() || undefined };
    const id = createBook(clean, admin.id);
    toast({ title: status === "published" ? "Book published" : "Draft saved", description: "Add photos from the editor.", simulated: true });
    router.push(`/admin/bookstore/books/${id}`);
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/bookstore/books" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-fg"><ArrowLeft className="size-4" /> Books</Link>
      <PageHeader
        title="Add book"
        description="Create one listing per edition/language combination."
        actions={
          <>
            <Button variant="secondary" onClick={() => submit("draft")}>Save as draft</Button>
            <Button onClick={() => submit("published")}><Eye /> Publish</Button>
          </>
        }
      />
      <DetailsFields d={d} set={set} errors={errors} canPrice isNew />
      <Card className="p-5">
        <NumberField label="Opening stock (copies on hand)" value={d.stock} onChange={(n) => set("stock", n)} error={errors.stock} required showZero hint="Recorded as the first inventory movement." />
      </Card>
    </div>
  );
}

/* ------------------------------ Edit book ------------------------------ */

export function BookEditorPage({ bookId }: { bookId: string }) {
  const { state, admin } = useSession();
  if (!admin || !hasAnyBookPermission(admin, ["books.edit", "books.photos", "inventory.adjust", "pricing.change"])) return <Restricted what="bookstore books" />;
  const book = state.books.find((b) => b.id === bookId);
  if (!book) return <EmptyState icon={<Library />} title="Book not found" action={<ButtonLink href="/admin/bookstore/books">Back to books</ButtonLink>} />;
  return <BookEditor key={`${book.id}:${book.updatedAt}`} book={book} />;
}

function BookEditor({ book }: { book: Book }) {
  const { state, admin, now } = useSession();
  const [tab, setTab] = useState<"details" | "photos" | "inventory" | "history">("details");
  const [d, setD] = useState<Book>(book);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stockOpen, setStockOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  if (!admin) return null;
  const canEdit = hasBookPermission(admin, "books.edit");
  const canPhotos = hasBookPermission(admin, "books.photos");
  const canPrice = hasBookPermission(admin, "pricing.change");
  const canStock = hasBookPermission(admin, "inventory.adjust");
  const dirty = JSON.stringify(d) !== JSON.stringify(book);
  const set = <K extends keyof Book>(k: K, v: Book[K]) => setD((x) => ({ ...x, [k]: v }));
  const reserved = reservedQty(state.bookOrders, book.id, now);
  const available = availableStock(book, state.bookOrders, now);
  const movements = state.stockMovements.filter((m) => m.bookId === book.id).sort((a, b) => b.at - a.at);
  const history = state.audit.filter((a) => a.ref === book.id).sort((a, b) => b.at - a.at);
  const photos = d.photos;

  const save = () => {
    const errs = validateDraft(d, state.books, book.id);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setTab(errs.photos ? "photos" : "details");
      return toast({ title: "Check the highlighted fields", tone: "error" });
    }
    saveBook({ ...d, slug: slugify(d.slug || d.title), title: d.title.trim(), author: d.author?.trim() || undefined, publisher: d.publisher?.trim() || undefined, isbn: d.isbn?.trim() || undefined }, admin.id);
    toast({ title: "Book saved", description: d.price !== book.price ? "New price applies to new orders only." : undefined, simulated: true });
  };

  const addUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const added: BookPhoto[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      try {
        added.push({ id: uid("ph"), kind: "upload", label: f.name.replace(/\.[^.]+$/, ""), fileName: f.name, dataUrl: await downscale(f) });
      } catch {
        toast({ title: `Couldn't read ${f.name}`, tone: "error" });
      }
    }
    setUploading(false);
    if (added.length) {
      setD((x) => ({ ...x, photos: [...x.photos, ...added] }));
      toast({ title: `${added.length} photo${added.length > 1 ? "s" : ""} added`, description: "Save the book to keep them.", tone: "info" });
    }
  };

  const removePhoto = (id: string) => {
    setD((x) => {
      const next = x.photos.filter((p) => p.id !== id);
      return { ...x, photos: next, primaryPhotoId: x.primaryPhotoId === id ? next[0]?.id ?? "" : x.primaryPhotoId };
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <Link href="/admin/bookstore/books" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-fg"><ArrowLeft className="size-4" /> Books</Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <PrimaryPhoto book={d} size="xs" className="w-14 shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold">{d.title || "Untitled book"}</h1>
              <Badge tone={STATUS_TONE[book.status]} dot>{STATUS_LABEL[book.status]}</Badge>
            </div>
            <p className="text-sm text-slate-500">{formatINR(book.price)} · {book.stock} on hand · {reserved} reserved · {book.sold} sold</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {book.status === "published" && <ButtonLink href={`/books/${book.slug}`} target="_blank" variant="secondary"><ExternalLink /> View</ButtonLink>}
          {canEdit && book.status === "draft" && <Button onClick={() => { setBookStatus(book.id, "published", admin.id); toast({ title: "Published", simulated: true }); }} disabled={dirty} title={dirty ? "Save changes first" : undefined}><Eye /> Publish</Button>}
          {canEdit && book.status === "published" && <Button variant="secondary" onClick={() => setBookStatus(book.id, "draft", admin.id)} disabled={dirty}>Unpublish</Button>}
          {canEdit && book.status !== "archived" && <Button variant="secondary" onClick={() => setBookStatus(book.id, "archived", admin.id)} disabled={dirty}><Archive /> Archive</Button>}
          {canEdit && book.status === "archived" && <Button variant="secondary" onClick={() => setBookStatus(book.id, "draft", admin.id)}><ArchiveRestore /> Restore</Button>}
        </div>
      </div>

      <Tabs
        label="Book editor"
        value={tab}
        onChange={setTab}
        items={[
          { value: "details", label: "Details" },
          { value: "photos", label: "Photos", count: photos.length },
          { value: "inventory", label: "Inventory", count: movements.length },
          { value: "history", label: "History", count: history.length },
        ]}
      />

      {tab === "details" && (
        <fieldset disabled={!canEdit && !canPrice} className="contents">
          {!canEdit && <Callout tone="info" icon={<Lock />}>You can view details but not edit them (needs “Add & edit books”).</Callout>}
          <DetailsFields d={d} set={set as never} errors={errors} canPrice={canPrice} isNew={false} />
        </fieldset>
      )}

      {tab === "photos" && (
        <Card>
          <CardHeader
            title="Photo gallery"
            description="The primary photo is used on listing cards. Others appear in the product gallery in this order."
            action={
              canPhotos ? (
                <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700", uploading && "pointer-events-none opacity-60")}>
                  <ImagePlus className="size-4" /> {uploading ? "Processing…" : "Upload photos"}
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void addUpload(e.target.files); e.target.value = ""; }} />
                </label>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><Lock className="size-3.5" /> Needs “Manage product photos”</span>
              )
            }
          />
          {errors.photos && <p className="px-5 pt-4 text-sm font-semibold text-red-600 dark:text-red-400">{errors.photos}</p>}
          <ul className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((p, i) => {
              const primary = p.id === d.primaryPhotoId;
              return (
                <li key={p.id} className={cn("rounded-2xl border-2 p-2", primary ? "border-brand-500" : "border-line")}>
                  <div className="relative">
                    <BookPhotoView book={d} photo={p} size="md" />
                    {primary && <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white"><Star className="size-3" /> Primary</span>}
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-fg">{p.label}</p>
                  {canPhotos && (
                    <div className="mt-2 flex items-center gap-0.5">
                      <IconButton label="Move earlier" size="sm" disabled={i === 0} onClick={() => set("photos", moveItem(photos, i, i - 1))}><ArrowLeft /></IconButton>
                      <IconButton label="Move later" size="sm" disabled={i === photos.length - 1} onClick={() => set("photos", moveItem(photos, i, i + 1))}><ArrowRight /></IconButton>
                      {!primary && <IconButton label="Set as primary cover" size="sm" onClick={() => set("primaryPhotoId", p.id)}><Star /></IconButton>}
                      <IconButton label="Remove photo" size="sm" className="ml-auto hover:text-red-600 dark:hover:text-red-400" disabled={photos.length <= 1} onClick={() => removePhoto(p.id)}><Trash2 /></IconButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <SimulatedNote>Uploads are resized and kept in this browser only — no file storage is connected in the prototype.</SimulatedNote>
          </div>
        </Card>
      )}

      {tab === "inventory" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="On hand" value={book.stock} icon={<Boxes />} />
            <StatCard label="Reserved by orders" value={reserved} icon={<Boxes />} tone="sky" hint="Unpaid within window or awaiting verification" />
            <StatCard label="Available to sell" value={available} icon={<Boxes />} tone={available <= 0 ? "rose" : available <= state.bookstore.lowStockThreshold ? "amber" : "emerald"} />
            <StatCard label="Sold (all time)" value={book.sold} icon={<Boxes />} tone="violet" />
          </div>
          <Card>
            <CardHeader title="Inventory history" description="Every change records the reason, quantity, who and when." action={canStock ? <Button size="sm" onClick={() => setStockOpen(true)}><Boxes /> Adjust stock</Button> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><Lock className="size-3.5" /> Needs “Adjust inventory”</span>} />
            {movements.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">No stock movements yet.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-semibold">When</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Change</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Type</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Reason</th>
                      <th className="px-5 py-2.5 text-left font-semibold">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id} className="border-t border-line">
                        <td className="px-5 py-2.5 text-slate-600" title={formatDateTime(m.at)}>{relativeTime(m.at, now)}</td>
                        <td className={cn("px-3 py-2.5 font-bold", m.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : m.delta < 0 ? "text-red-600 dark:text-red-400" : "text-slate-500")}>{m.delta > 0 ? "+" : ""}{m.delta}</td>
                        <td className="px-3 py-2.5"><Badge size="xs" tone={m.kind === "added" || m.kind === "restock" ? "green" : m.kind === "sale" ? "sky" : m.kind === "correction" ? "violet" : "amber"}>{m.kind}</Badge></td>
                        <td className="px-3 py-2.5 text-slate-600">{m.reason}{m.orderId && <Link href={`/admin/bookstore/orders/${m.orderId}`} className="ml-1 font-semibold text-brand-700 dark:text-brand-300 hover:underline">view order</Link>}</td>
                        <td className="px-5 py-2.5 text-slate-600">{m.actor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "history" && (
        <Card>
          <CardHeader title="Change history" description="Details, prices, photos, status and stock changes." />
          {history.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No recorded changes yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((h) => (
                <li key={h.id} className="px-5 py-3">
                  <p className="text-sm text-fg">{h.text}</p>
                  <p className="text-xs text-slate-500">{h.actor} · {formatDateTime(h.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className={cn("fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur transition-transform lg:left-64", dirty ? "translate-y-0" : "invisible translate-y-full")} aria-hidden={!dirty}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-fg"><span className="size-2 rounded-full bg-amber-500" /> Unsaved changes</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setD(book); setErrors({}); }} tabIndex={dirty ? 0 : -1}><Undo2 /> Discard</Button>
            <Button onClick={save} tabIndex={dirty ? 0 : -1}><Save /> Save changes</Button>
          </div>
        </div>
      </div>
      {stockOpen && <StockDialog book={book} onClose={() => setStockOpen(false)} />}
    </div>
  );
}

