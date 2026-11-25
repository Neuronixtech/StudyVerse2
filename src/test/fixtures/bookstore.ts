import { DEFAULT_BOOKSTORE_SETTINGS } from "@/lib/mock/bookstore";
import type { Book, BookOrder, BookstoreSettings } from "@/lib/types";
import { FIXED_NOW, HOUR } from "./time";

export const settings = (overrides: Partial<BookstoreSettings> = {}): BookstoreSettings => ({ ...DEFAULT_BOOKSTORE_SETTINGS, ...overrides });

/** A published, in-stock paperback priced ₹400 (MRP ₹500). */
export function makeBook(id: string, overrides: Partial<Book> = {}): Book {
  return {
    id,
    slug: id,
    title: `Book ${id}`,
    author: "Test Author",
    publisher: "Test Publisher",
    isbn: "978-0-00-000000-0",
    examIds: ["jee-main"],
    subjectIds: ["physics"],
    description: "A test book.",
    language: "English",
    edition: "1st edition",
    format: "Paperback",
    pages: 300,
    mrp: 500,
    price: 400,
    stock: 10,
    status: "published",
    theme: "teal",
    photos: [],
    primaryPhotoId: "",
    sold: 0,
    featured: false,
    createdAt: FIXED_NOW - 30 * 86_400_000,
    updatedAt: FIXED_NOW - 30 * 86_400_000,
    ...overrides,
  };
}

/** An order for `qty` × `book`, pending payment, reserved for 24 hours from FIXED_NOW − 1h. */
export function makeOrder(id: string, book: Book, qty = 1, overrides: Partial<BookOrder> = {}): BookOrder {
  const subtotal = book.price * qty;
  return {
    id,
    number: `SVB-${id}`,
    learnerId: "l-rohan",
    createdAt: FIXED_NOW - HOUR,
    items: [{ bookId: book.id, title: book.title, theme: book.theme, qty, unitPrice: book.price, mrp: book.mrp }],
    subtotal,
    shipping: 0,
    total: subtotal,
    address: { fullName: "Test Learner", mobile: "9876543210", line1: "1 Test Street", locality: "Kothrud", city: "Pune", state: "Maharashtra", pin: "411038" },
    status: "pending_payment",
    reservationExpiresAt: FIXED_NOW + 23 * HOUR,
    payments: [],
    refunds: [],
    events: [],
    ...overrides,
  };
}
