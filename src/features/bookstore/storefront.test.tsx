import { render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Book, BookstoreSettings, ExamCategory, Subject } from "@/lib/types";
import { BookCatalog } from "./storefront";

/* ========================================================================
 * Fixtures
 *
 * Everything the component reads from the data layer is built here, so when
 * the real API contract lands only these factories need to change.
 * ====================================================================== */

let seq = 0;

/** A published, in-stock book. Override only what a test cares about. */
function makeBook(overrides: Partial<Book> = {}): Book {
  seq += 1;
  return {
    id: `book-${seq}`,
    slug: `book-${seq}`,
    title: `Book Title ${seq}`,
    author: "Test Author",
    publisher: "Test Publisher",
    isbn: `978-0-00-${String(seq).padStart(6, "0")}-0`,
    examIds: ["jee-main"],
    subjectIds: ["physics"],
    description: "A test book.",
    language: "English",
    edition: "2026",
    format: "Paperback",
    pages: 320,
    mrp: 500,
    price: 400,
    stock: 10,
    status: "published",
    theme: "teal",
    photos: [],
    primaryPhotoId: "",
    sold: 0,
    featured: false,
    createdAt: 1_700_000_000_000 + seq,
    updatedAt: 1_700_000_000_000 + seq,
    ...overrides,
  };
}

function makeBookstoreSettings(overrides: Partial<BookstoreSettings> = {}): BookstoreSettings {
  return {
    shippingFee: 60,
    freeShippingThreshold: 999,
    lowStockThreshold: 5,
    reservationHours: 48,
    returnWindowDays: 7,
    deliveryEstimate: "4–7 days",
    upiId: "store@upi",
    payeeName: "StudyVerse",
    bankName: "Test Bank",
    accountName: "StudyVerse",
    accountNumber: "000111222333",
    ifsc: "TEST0000001",
    emailAlerts: true,
    ...overrides,
  };
}

const makeExam = (overrides: Partial<ExamCategory> = {}): ExamCategory => ({
  id: "jee-main",
  name: "JEE Main",
  short: "JEE Main",
  description: "Exam description",
  ...overrides,
});

const makeSubject = (overrides: Partial<Subject> = {}): Subject => ({ id: "physics", name: "Physics", ...overrides });

/** Catalog taxonomy used by the component (replaces `@/lib/mock/catalog`). */
const TEST_EXAMS: ExamCategory[] = [
  makeExam({ id: "jee-main", name: "JEE Main" }),
  makeExam({ id: "mht-cet", name: "MHT-CET" }),
  makeExam({ id: "bitsat", name: "BITSAT", comingSoon: true }),
];
const TEST_SUBJECTS: Subject[] = [
  makeSubject({ id: "physics", name: "Physics" }),
  makeSubject({ id: "chemistry", name: "Chemistry" }),
  makeSubject({ id: "mathematics", name: "Mathematics" }),
];

/* ========================================================================
 * Mocks (hoisted). Behaviour is set per test in `beforeEach` / helpers.
 * ====================================================================== */

const pushMock = vi.fn();
let searchString = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/books/catalog",
  useSearchParams: () => new URLSearchParams(searchString),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/hooks", () => ({
  useSession: vi.fn(),
  useSimulatedLoad: vi.fn(),
}));

// Keep the rest of the catalog module; swap only the taxonomy lists.
vi.mock("@/lib/mock/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mock/catalog")>()),
  get EXAMS() {
    return TEST_EXAMS;
  },
  get SUBJECTS() {
    return TEST_SUBJECTS;
  },
}));

// BookCard owns cart/toast behaviour and has its own concerns; stub it so these
// tests only verify what the storefront decides to show.
vi.mock("@/components/bookstore/book-card", () => ({
  BookCard: ({ book }: { book: Book }) => (
    <article>
      <h3>{book.title}</h3>
    </article>
  ),
}));

import { useSession, useSimulatedLoad } from "@/lib/hooks";

type LoadStatus = "success" | "loading" | "error";

function setLoad(status: LoadStatus, retry = vi.fn()) {
  vi.mocked(useSimulatedLoad).mockReturnValue({ status, retry });
  return retry;
}

function setSession({ books = [], bookstore }: { books?: Book[]; bookstore?: Partial<BookstoreSettings> } = {}) {
  vi.mocked(useSession).mockReturnValue({
    state: { books, bookOrders: [], bookstore: makeBookstoreSettings(bookstore) },
    now: 1_800_000_000_000,
  } as unknown as ReturnType<typeof useSession>);
}

/** Render the catalog with a given dataset and URL query string. */
function renderCatalog({ books = [], search = "" }: { books?: Book[]; search?: string } = {}) {
  searchString = search;
  setSession({ books });
  return render(<BookCatalog />);
}

/** Titles of the books currently listed, in display order. */
const listedTitles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

/** The "N books" line is split across <strong>; match on its combined text. */
const resultCount = (text: string) => screen.getByText((_, el) => el?.tagName === "P" && el.textContent === text);

beforeEach(() => {
  seq = 0;
  searchString = "";
  setLoad("success");
  setSession();
});

/* ========================================================================
 * BookCatalog — default / success state
 * ====================================================================== */

describe("BookCatalog — default state", () => {
  it("renders the page heading, intro copy and breadcrumbs", () => {
    renderCatalog({ books: [makeBook()] });

    expect(screen.getByRole("heading", { level: 1, name: "All books" })).toBeInTheDocument();
    expect(screen.getByText(/each edition and language is listed separately/i)).toBeInTheDocument();

    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(crumbs).getByRole("link", { name: "Bookstore" })).toHaveAttribute("href", "/books");
    expect(within(crumbs).getByText("All books")).toHaveAttribute("aria-current", "page");
  });

  it("lists every published book", () => {
    renderCatalog({ books: [makeBook({ title: "Alpha" }), makeBook({ title: "Beta" }), makeBook({ title: "Gamma" })] });

    expect(listedTitles()).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gamma" })).toBeInTheDocument();
  });

  it("hides draft and archived books", () => {
    renderCatalog({
      books: [
        makeBook({ title: "Live Book" }),
        makeBook({ title: "Draft Book", status: "draft" }),
        makeBook({ title: "Archived Book", status: "archived" }),
      ],
    });

    expect(listedTitles()).toEqual(["Live Book"]);
    expect(screen.queryByRole("heading", { name: "Draft Book" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Archived Book" })).not.toBeInTheDocument();
  });

  it("shows the plural result count", () => {
    renderCatalog({ books: [makeBook(), makeBook(), makeBook()] });
    expect(resultCount("3 books")).toBeInTheDocument();
  });

  it("shows the singular result count for exactly one book", () => {
    renderCatalog({ books: [makeBook()] });
    expect(resultCount("1 book")).toBeInTheDocument();
  });

  it("counts only published books", () => {
    renderCatalog({ books: [makeBook(), makeBook({ status: "draft" })] });
    expect(resultCount("1 book")).toBeInTheDocument();
  });

  it("sorts by most popular (units sold) by default", () => {
    renderCatalog({
      books: [makeBook({ title: "Slow Seller", sold: 5 }), makeBook({ title: "Best Seller", sold: 500 }), makeBook({ title: "Mid Seller", sold: 50 })],
    });

    expect(listedTitles()).toEqual(["Best Seller", "Mid Seller", "Slow Seller"]);
    expect(screen.getByRole("combobox", { name: "Sort books" })).toHaveValue("popular");
  });

  it("offers all four sort options", () => {
    renderCatalog({ books: [makeBook()] });

    const sort = screen.getByRole("combobox", { name: "Sort books" });
    const options = within(sort).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Most popular", "Newest arrivals", "Price: low to high", "Price: high to low"]);
  });

  it("starts with an empty search box and no clear-search button", () => {
    renderCatalog({ books: [makeBook()] });

    expect(screen.getByLabelText("Search books")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });
});

describe("BookCatalog — filter panel (default state)", () => {
  const books = () => [
    makeBook({ publisher: "Zeta Press" }),
    makeBook({ publisher: "Alpha House" }),
    makeBook({ publisher: undefined }),
    makeBook({ publisher: "Alpha House" }),
  ];

  it("renders each filter group", () => {
    renderCatalog({ books: books() });

    const filters = screen.getByRole("complementary", { name: "Filters" });
    for (const name of ["Exam", "Subject", "Price", "Availability", "Publisher"]) {
      expect(within(filters).getByRole("group", { name })).toBeInTheDocument();
    }
  });

  it("lists exams from the taxonomy and hides coming-soon exams", () => {
    renderCatalog({ books: books() });

    expect(screen.getByRole("radio", { name: "All exams" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "JEE Main" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "MHT-CET" })).not.toBeChecked();
    expect(screen.queryByRole("radio", { name: "BITSAT" })).not.toBeInTheDocument();
  });

  it("lists every subject, with 'All subjects' selected", () => {
    renderCatalog({ books: books() });

    expect(screen.getByRole("radio", { name: "All subjects" })).toBeChecked();
    for (const name of ["Physics", "Chemistry", "Mathematics"]) {
      expect(screen.getByRole("radio", { name })).not.toBeChecked();
    }
  });

  it("lists every price band, with 'Any price' selected", () => {
    renderCatalog({ books: books() });

    expect(screen.getByRole("radio", { name: "Any price" })).toBeChecked();
    for (const name of ["Under ₹300", "₹300 – ₹600", "₹600 – ₹900", "₹900 and above"]) {
      expect(screen.getByRole("radio", { name })).not.toBeChecked();
    }
  });

  it("starts with the stock filter off", () => {
    renderCatalog({ books: books() });
    expect(screen.getByRole("checkbox", { name: "Hide out-of-stock books" })).not.toBeChecked();
  });

  it("lists distinct publishers alphabetically, using 'Not listed' as the fallback", () => {
    renderCatalog({ books: books() });

    const group = screen.getByRole("group", { name: "Publisher" });
    const labels = within(group)
      .getAllByRole("checkbox")
      .map((c) => c.closest("label")?.textContent);
    expect(labels).toEqual(["Alpha House", "Not listed", "Zeta Press"]);
    within(group)
      .getAllByRole("checkbox")
      .forEach((c) => expect(c).not.toBeChecked());
  });

  it("does not offer 'Clear all filters' until a filter is active", () => {
    renderCatalog({ books: books() });
    expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
  });
});
