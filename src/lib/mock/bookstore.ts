import { totalsFor } from "../bookstore";
import type {
  Address,
  AppNotification,
  Book,
  BookOrder,
  BookPhoto,
  BookstoreSettings,
  CartItem,
  ExamId,
  OrderEvent,
  OrderItem,
  StockMovement,
  SubjectId,
  ThumbTheme,
} from "../types";
import { DAY, HOUR, MINUTE } from "../utils";

export const DEFAULT_BOOKSTORE_SETTINGS: BookstoreSettings = {
  shippingFee: 49,
  freeShippingThreshold: 999,
  lowStockThreshold: 5,
  reservationHours: 24,
  returnWindowDays: 7,
  deliveryEstimate: "4–7 business days across India",
  upiId: "studyverse.books@upi",
  payeeName: "StudyVerse Books (Demo)",
  bankName: "Demo Bank of India",
  accountName: "StudyVerse Learning Pvt Ltd (Demo)",
  accountNumber: "0000 9876 5432 1098",
  ifsc: "DEMO0004321",
  emailAlerts: false,
};

function photos(id: string, extra: BookPhoto["kind"][] = ["back", "contents", "sample"]): BookPhoto[] {
  const labels: Record<BookPhoto["kind"], string> = { cover: "Front cover", back: "Back cover", contents: "Contents page", sample: "Sample page", upload: "Photo" };
  return [{ id: `${id}-ph-cover`, kind: "cover", label: labels.cover }, ...extra.map((k) => ({ id: `${id}-ph-${k}`, kind: k, label: labels[k] }))];
}

interface BookSpec {
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  exams: ExamId[];
  subjects: SubjectId[];
  mrp: number;
  price: number;
  stock: number;
  status?: Book["status"];
  language?: string;
  edition?: string;
  pages?: number;
  theme: ThumbTheme;
  sold: number;
  daysOld: number;
  featured?: boolean;
  description: string;
}

function book(spec: BookSpec, anchor: number): Book {
  const ph = photos(spec.id);
  return {
    id: spec.id,
    slug: spec.id.replace(/^b-/, ""),
    title: spec.title,
    author: spec.author,
    publisher: spec.publisher,
    isbn: spec.isbn,
    examIds: spec.exams,
    subjectIds: spec.subjects,
    description: spec.description,
    language: spec.language,
    edition: spec.edition,
    format: "Paperback",
    pages: spec.pages,
    mrp: spec.mrp,
    price: spec.price,
    stock: spec.stock,
    status: spec.status ?? "published",
    theme: spec.theme,
    photos: ph,
    primaryPhotoId: ph[0].id,
    sold: spec.sold,
    featured: spec.featured ?? false,
    createdAt: anchor - spec.daysOld * DAY,
    updatedAt: anchor - Math.max(1, Math.floor(spec.daysOld / 3)) * DAY,
  };
}

export function seedBooks(anchor: number): Book[] {
  const specs: BookSpec[] = [
    {
      id: "b-mechanics-problem-solver", title: "Mechanics Problem Solver for JEE", author: "Dr. Ananya Krishnan", publisher: "StudyVerse Press", isbn: "978-93-90011-21-4",
      exams: ["jee-main", "jee-advanced"], subjects: ["physics"], mrp: 650, price: 520, stock: 42, language: "English", edition: "3rd edition", pages: 512, theme: "teal", sold: 1840, daysOld: 120, featured: true,
      description: "Over 900 graded problems in kinematics, laws of motion, work–energy, rotation and gravitation, each with a step-by-step solution and a free-body diagram. Companion to the Mechanics Masterclass course.",
    },
    {
      id: "b-organic-mechanism-maps", title: "Organic Chemistry Mechanism Maps", author: "Rahul Bhatia", publisher: "StudyVerse Press", isbn: "978-93-90011-34-4",
      exams: ["jee-main", "jee-advanced"], subjects: ["chemistry"], mrp: 595, price: 499, stock: 4, language: "English", edition: "2nd edition", pages: 288, theme: "violet", sold: 1210, daysOld: 90, featured: true,
      description: "Sixty-plus reaction mechanisms drawn as one-page flow maps, with reagent tables and named-reaction summaries you can revise in minutes before the exam.",
    },
    {
      id: "b-calculus-workbook", title: "Calculus Workbook: 1000 Practice Problems", author: "Neha Kulkarni", publisher: "Aarohan Publications", isbn: "978-81-95522-07-9",
      exams: ["jee-main", "jee-advanced", "mht-cet"], subjects: ["mathematics"], mrp: 720, price: 599, stock: 18, language: "English", edition: "1st edition", pages: 436, theme: "amber", sold: 980, daysOld: 60, featured: true,
      description: "Limits, continuity, differentiation, applications of derivatives and integration — organised into short sets that build from fundamentals to JEE Advanced level.",
    },
    {
      id: "b-jee-main-solved-papers", title: "JEE Main Chapter-wise Solved Papers 2015–2026", author: "StudyVerse Faculty", publisher: "Prism Educational", isbn: "978-93-88712-40-1",
      exams: ["jee-main"], subjects: ["physics", "chemistry", "mathematics"], mrp: 899, price: 749, stock: 0, language: "English", edition: "2027 edition", pages: 960, theme: "sky", sold: 3120, daysOld: 40, featured: true,
      description: "Every JEE Main question from 2015 to 2026 arranged chapter-wise with detailed solutions, difficulty tags and frequency analysis for each topic.",
    },
    {
      id: "b-jee-main-solved-papers-hindi", title: "JEE Main Chapter-wise Solved Papers 2015–2026 (Hindi)", author: "StudyVerse Faculty", publisher: "Prism Educational", isbn: "978-93-88712-41-8",
      exams: ["jee-main"], subjects: ["physics", "chemistry", "mathematics"], mrp: 899, price: 749, stock: 9, language: "Hindi", edition: "2027 edition", pages: 984, theme: "sky", sold: 640, daysOld: 40,
      description: "हिंदी माध्यम संस्करण — the same chapter-wise solved papers, fully translated, with solutions and topic-wise frequency analysis.",
    },
    {
      id: "b-inorganic-revision-notes", title: "Inorganic Chemistry Quick Revision Notes", author: "Farah Siddiqui", publisher: "Bodhi Books", isbn: "978-81-94310-55-2",
      exams: ["jee-main", "mht-cet"], subjects: ["chemistry"], mrp: 350, price: 299, stock: 3, language: "English", edition: "4th edition", pages: 196, theme: "rose", sold: 1460, daysOld: 150,
      description: "Periodic trends, bonding, p-block exceptions and coordination compounds condensed into tables and one-liners for last-month revision.",
    },
    {
      id: "b-coordinate-geometry", title: "Coordinate Geometry Simplified", author: "Neha Kulkarni", publisher: "Aarohan Publications", isbn: "978-81-95522-11-6",
      exams: ["jee-main", "mht-cet"], subjects: ["mathematics"], mrp: 480, price: 420, stock: 25, language: "English", edition: "2nd edition", pages: 312, theme: "emerald", sold: 720, daysOld: 200,
      description: "Straight lines, circles and conics explained visually, with parametric forms and locus problems solved the fast way.",
    },
    {
      id: "b-electrostatics-workbook", title: "Electrostatics & Current Electricity Workbook", author: "Dr. Ananya Krishnan", publisher: "StudyVerse Press", isbn: "978-93-90011-48-1",
      exams: ["jee-main", "jee-advanced"], subjects: ["physics"], mrp: 560, price: 475, stock: 30, language: "English", edition: "1st edition", pages: 344, theme: "teal", sold: 530, daysOld: 18,
      description: "Gauss's law, capacitor networks and circuit analysis drills with Kirchhoff shortcuts, meter bridge and potentiometer problems.",
    },
    {
      id: "b-mht-cet-practice-papers", title: "MHT-CET PCM Practice Papers", author: "Sanjay Patwardhan", publisher: "Kalam Academic", isbn: "978-93-87120-66-3",
      exams: ["mht-cet"], subjects: ["physics", "chemistry", "mathematics"], mrp: 750, price: 640, stock: 14, language: "English", edition: "2027 edition", pages: 520, theme: "amber", sold: 890, daysOld: 25, featured: true,
      description: "Twenty full-length MHT-CET pattern papers with answer keys and speed-strategy notes. No negative marking, state-board aligned.",
    },
    {
      id: "b-mht-cet-practice-papers-marathi", title: "MHT-CET PCM Practice Papers (Marathi)", author: "Sanjay Patwardhan", publisher: "Kalam Academic", isbn: "978-93-87120-67-0",
      exams: ["mht-cet"], subjects: ["physics", "chemistry", "mathematics"], mrp: 750, price: 640, stock: 6, language: "Marathi", edition: "2027 edition", pages: 540, theme: "amber", sold: 310, daysOld: 25,
      description: "मराठी माध्यम — twenty full-length MHT-CET pattern papers with answer keys, translated for Marathi-medium students.",
    },
    {
      id: "b-jee-advanced-mock-papers", title: "JEE Advanced Full-length Mock Papers", author: "StudyVerse Faculty", publisher: "Prism Educational", isbn: "978-93-88712-52-4",
      exams: ["jee-advanced"], subjects: ["physics", "chemistry", "mathematics"], mrp: 980, price: 840, stock: 11, language: "English", edition: "2nd edition", pages: 640, theme: "violet", sold: 760, daysOld: 10, featured: true,
      description: "Ten paper-1 and paper-2 pairs in the latest JEE Advanced pattern, including multi-select partial marking and numerical-answer sections.",
    },
    {
      id: "b-physical-chemistry-drills", title: "Physical Chemistry Numericals Drill Book", author: "Rahul Bhatia", publisher: "Bodhi Books", isbn: "978-81-94310-61-3",
      exams: ["jee-main", "mht-cet"], subjects: ["chemistry"], mrp: 540, price: 460, stock: 0, language: "English", edition: "1st edition", pages: 268, theme: "rose", sold: 680, daysOld: 75,
      description: "Mole concept, thermodynamics, equilibrium and electrochemistry numericals with a repeatable unit-analysis method.",
    },
    {
      id: "b-pcm-formula-handbook", title: "PCM Formula Handbook (Pocket)", author: "StudyVerse Faculty", publisher: "StudyVerse Press", isbn: "978-93-90011-02-3",
      exams: ["jee-main", "jee-advanced", "mht-cet"], subjects: ["physics", "chemistry", "mathematics"], mrp: 199, price: 169, stock: 120, language: "English", edition: "5th edition", pages: 160, theme: "emerald", sold: 4210, daysOld: 300, featured: true,
      description: "Every formula, constant and standard result for Physics, Chemistry and Mathematics in a pocket-size book you can carry to every class.",
    },
    {
      id: "b-algebra-foundations", title: "Algebra Foundations for Engineering Entrances",
      exams: ["jee-main"], subjects: ["mathematics"], mrp: 450, price: 450, stock: 7, language: "English", pages: 280, theme: "sky", sold: 120, daysOld: 5,
      description: "Quadratics, sequences, binomial theorem, permutations and complex numbers from first principles. Author, publisher and ISBN details were not supplied for this listing.",
    },
    {
      id: "b-modern-physics-advanced", title: "Modern Physics for JEE Advanced", author: "Dr. Ananya Krishnan", publisher: "StudyVerse Press",
      exams: ["jee-advanced"], subjects: ["physics"], mrp: 520, price: 450, stock: 40, status: "draft", language: "English", edition: "1st edition", theme: "teal", sold: 0, daysOld: 3,
      description: "Draft listing — photoelectric effect, Bohr model, nuclei and radioactivity. Not yet visible in the storefront.",
    },
    {
      id: "b-jee-main-2025-crash-guide", title: "JEE Main 2025 Crash Course Guide", author: "StudyVerse Faculty", publisher: "Prism Educational", isbn: "978-93-88712-12-8",
      exams: ["jee-main"], subjects: ["physics", "chemistry", "mathematics"], mrp: 499, price: 299, stock: 12, status: "archived", language: "English", edition: "2025 edition", theme: "amber", sold: 2300, daysOld: 400,
      description: "Archived edition kept for historical orders. Replaced by the 2027 solved papers.",
    },
  ];
  return specs.map((s) => book(s, anchor));
}

export function seedAddresses(): Address[] {
  return [
    { id: "ad-rohan-home", learnerId: "l-rohan", fullName: "Rohan Iyer", mobile: "9444077889", line1: "Flat 4B, Lotus Residency, 12 Second Main Road", locality: "Besant Nagar", city: "Chennai", state: "Tamil Nadu", pin: "600090", isDefault: true },
    { id: "ad-rohan-hostel", learnerId: "l-rohan", fullName: "Rohan Iyer", mobile: "9444077889", line1: "Room 214, Sunrise Boys Hostel, Talwandi", locality: "Talwandi", city: "Kota", state: "Rajasthan", pin: "324005", instructions: "Leave with hostel warden if I'm in class", isDefault: false },
    { id: "ad-diya", learnerId: "l-diya", fullName: "Diya Sharma", mobile: "9829044556", line1: "C-21, Shanti Path", locality: "Malviya Nagar", city: "Jaipur", state: "Rajasthan", pin: "302017", isDefault: true },
    { id: "ad-aarav", learnerId: "l-aarav", fullName: "Aarav Mehta", mobile: "9822011223", line1: "7, Sai Krupa Society, Paud Road", locality: "Kothrud", city: "Pune", state: "Maharashtra", pin: "411038", isDefault: true },
    { id: "ad-sneha", learnerId: "l-sneha", fullName: "Sneha Patil", mobile: "9765033445", line1: "Plot 18, Ganesh Colony, College Road", locality: "Gangapur Road", city: "Nashik", state: "Maharashtra", pin: "422005", isDefault: true },
    { id: "ad-ishita", learnerId: "l-ishita", fullName: "Ishita Banerjee", mobile: "9830012121", line1: "22/1 Hindustan Park", locality: "Gariahat", city: "Kolkata", state: "West Bengal", pin: "700029", isDefault: true },
    { id: "ad-kabir", learnerId: "l-kabir", fullName: "Kabir Khan", mobile: "9893024680", line1: "E-5/41 Arera Colony", locality: "Arera Colony", city: "Bhopal", state: "Madhya Pradesh", pin: "462016", isDefault: true },
    { id: "ad-vihaan", learnerId: "l-vihaan", fullName: "Vihaan Reddy", mobile: "9849034343", line1: "8-2-293 Road No. 14", locality: "Banjara Hills", city: "Hyderabad", state: "Telangana", pin: "500034", isDefault: true },
    { id: "ad-meera", learnerId: "l-meera", fullName: "Meera Joshi", mobile: "9826056565", line1: "45, Saket Nagar", locality: "Saket", city: "Indore", state: "Madhya Pradesh", pin: "452018", isDefault: true },
    { id: "ad-tanvi", learnerId: "l-tanvi", fullName: "Tanvi Deshmukh", mobile: "9823013579", line1: "12 Shivaji Nagar", locality: "Dharampeth", city: "Nagpur", state: "Maharashtra", pin: "440010", isDefault: true },
    { id: "ad-karan", learnerId: "l-karan", fullName: "Karan Gupta", mobile: "9935066778", line1: "B-14, Sector C, Aliganj", locality: "Aliganj", city: "Lucknow", state: "Uttar Pradesh", pin: "226024", isDefault: true },
    { id: "ad-ananya", learnerId: "l-ananya", fullName: "Ananya Singh", mobile: "9431090909", line1: "House 9, Road 3, Rajendra Nagar", locality: "Rajendra Nagar", city: "Patna", state: "Bihar", pin: "800016", isDefault: true },
  ];
}

export interface BookstoreSeed {
  books: Book[];
  bookOrders: BookOrder[];
  addresses: Address[];
  stockMovements: StockMovement[];
  carts: Record<string, CartItem[]>;
  notifications: AppNotification[];
  bookstore: BookstoreSettings;
}

export function seedBookstore(anchor: number): BookstoreSeed {
  const books = seedBooks(anchor);
  const addresses = seedAddresses();
  const settings = DEFAULT_BOOKSTORE_SETTINGS;
  const ago = (days: number) => anchor - days * DAY;
  const byId = (id: string) => books.find((b) => b.id === id)!;
  const addr = (learnerId: string) => {
    const a = addresses.find((x) => x.learnerId === learnerId && x.isDefault)!;
    return { fullName: a.fullName, mobile: a.mobile, line1: a.line1, locality: a.locality, city: a.city, state: a.state, pin: a.pin, instructions: a.instructions };
  };
  const item = (bookId: string, qty: number): OrderItem => {
    const b = byId(bookId);
    return { bookId, title: b.title, author: b.author, isbn: b.isbn, edition: b.edition, language: b.language, theme: b.theme, qty, unitPrice: b.price, mrp: b.mrp };
  };

  let evSeq = 0;
  const ev = (at: number, text: string, actor = "System", customerVisible = true): OrderEvent => ({ id: `ev-${++evSeq}`, at, actor, text, customerVisible });

  const order = (o: Partial<BookOrder> & Pick<BookOrder, "id" | "number" | "learnerId" | "createdAt" | "items" | "status">): BookOrder => {
    const t = totalsFor(o.items, settings);
    return {
      subtotal: t.subtotal,
      shipping: t.shipping,
      total: t.total,
      address: addr(o.learnerId),
      reservationExpiresAt: o.createdAt + settings.reservationHours * HOUR,
      payments: [],
      refunds: [],
      events: [ev(o.createdAt, "Order placed. Awaiting payment.", "Customer")],
      ...o,
    } as BookOrder;
  };

  const pay = (at: number, amount: number, reference: string, method: "upi" | "bank" = "upi", extra: Partial<BookOrder["payments"][number]> = {}) => ({
    id: `pay-${reference.slice(-4)}`,
    submittedAt: at,
    method,
    reference,
    amount,
    status: "submitted" as const,
    ...extra,
  });

  const orders: BookOrder[] = [];

  // Pending payment, reservation active (Rohan)
  {
    const created = anchor - 3 * HOUR;
    orders.push(order({ id: "o-10241", number: "SVB-10241", learnerId: "l-rohan", createdAt: created, items: [item("b-organic-mechanism-maps", 1), item("b-pcm-formula-handbook", 1)], status: "pending_payment" }));
  }
  // Payment verification (Diya)
  {
    const created = anchor - 7 * HOUR;
    const o = order({ id: "o-10238", number: "SVB-10238", learnerId: "l-diya", createdAt: created, items: [item("b-jee-main-solved-papers-hindi", 1), item("b-calculus-workbook", 1)], status: "payment_verification" });
    o.payments = [pay(created + 40 * MINUTE, o.total, "418822001934", "upi", { screenshotName: "phonepe-receipt.png" })];
    o.events.push(ev(created + 40 * MINUTE, `Payment details submitted (UPI ref 418822001934, ₹${o.total}). Awaiting verification.`, "Customer"));
    orders.push(o);
  }
  // Payment verification with amount mismatch (Kabir)
  {
    const created = anchor - 20 * HOUR;
    const o = order({ id: "o-10236", number: "SVB-10236", learnerId: "l-kabir", createdAt: created, items: [item("b-mechanics-problem-solver", 1)], status: "payment_verification" });
    o.payments = [pay(created + 2 * HOUR, 520, "NEFT-K88120334", "bank")];
    o.events.push(ev(created + 2 * HOUR, "Payment details submitted (bank ref NEFT-K88120334, ₹520). Awaiting verification.", "Customer"));
    orders.push(o);
  }
  // Payment rejected, can resubmit (Aarav — no learning subscription needed)
  {
    const created = anchor - 10 * HOUR;
    const o = order({ id: "o-10233", number: "SVB-10233", learnerId: "l-aarav", createdAt: created, items: [item("b-mechanics-problem-solver", 1), item("b-pcm-formula-handbook", 2)], status: "payment_rejected" });
    o.payments = [
      pay(created + HOUR, o.total, "77341209", "upi", { status: "rejected", decidedBy: "Arjun Das", decidedAt: created + 4 * HOUR, rejectionReason: "We couldn't find UPI reference 77341209 in our account. UPI transaction IDs are 12 digits — please check your payment app and resubmit." }),
    ];
    o.events.push(ev(created + HOUR, "Payment details submitted (UPI ref 77341209).", "Customer"));
    o.events.push(ev(created + 4 * HOUR, "Payment rejected: reference not found. You can resubmit against this order.", "Arjun Das"));
    orders.push(o);
  }
  // Pending payment, reservation expired (Karan)
  {
    const created = anchor - 30 * HOUR;
    const o = order({ id: "o-10199", number: "SVB-10199", learnerId: "l-karan", createdAt: created, items: [item("b-coordinate-geometry", 1)], status: "pending_payment" });
    orders.push(o);
  }
  // Processing (Ishita)
  {
    const created = ago(1.6);
    const o = order({ id: "o-10230", number: "SVB-10230", learnerId: "l-ishita", createdAt: created, items: [item("b-jee-advanced-mock-papers", 1), item("b-electrostatics-workbook", 1)], status: "processing" });
    o.payments = [pay(created + HOUR, o.total, "509931245520", "upi", { status: "approved", decidedBy: "Vikram Rao", decidedAt: ago(1) })];
    o.events.push(ev(created + HOUR, "Payment details submitted (UPI ref 509931245520).", "Customer"));
    o.events.push(ev(ago(1), "Payment confirmed.", "Vikram Rao"), ev(ago(1), "Order moved to Processing.", "System"));
    orders.push(o);
  }
  // Processing but on hold — an item can't be fulfilled (Kabir)
  {
    const created = ago(2.5);
    const o = order({ id: "o-10225", number: "SVB-10225", learnerId: "l-kabir", createdAt: created, items: [item("b-physical-chemistry-drills", 1), item("b-inorganic-revision-notes", 1)], status: "processing" });
    o.payments = [pay(created + 3 * HOUR, o.total, "611208877410", "upi", { status: "approved", decidedBy: "Vikram Rao", decidedAt: ago(2) })];
    o.hold = { reason: "Physical Chemistry Numericals Drill Book is out of stock. Restock expected within 5 days; the whole order ships together.", at: ago(1.8), by: "Priya Nair" };
    o.events.push(ev(created + 3 * HOUR, "Payment details submitted (UPI ref 611208877410).", "Customer"));
    o.events.push(ev(ago(2), "Payment confirmed.", "Vikram Rao"), ev(ago(2), "Order moved to Processing.", "System"));
    o.events.push(ev(ago(1.8), "Order on hold: one book is temporarily unavailable. The entire order will ship together once restocked.", "Priya Nair"));
    orders.push(o);
  }
  // Processing with a cancellation request (Meera)
  {
    const created = ago(1.2);
    const o = order({ id: "o-10212", number: "SVB-10212", learnerId: "l-meera", createdAt: created, items: [item("b-calculus-workbook", 1), item("b-coordinate-geometry", 1)], status: "processing" });
    o.payments = [pay(created + 2 * HOUR, o.total, "NEFT-M20991184", "bank", { status: "approved", decidedBy: "Arjun Das", decidedAt: ago(1) })];
    o.cancellation = { requestedAt: ago(0.3), reason: "My cousin is giving me his copies of both books, so I no longer need them.", status: "requested" };
    o.events.push(ev(created + 2 * HOUR, "Payment details submitted (bank ref NEFT-M20991184).", "Customer"));
    o.events.push(ev(ago(1), "Payment confirmed.", "Arjun Das"), ev(ago(1), "Order moved to Processing.", "System"));
    o.events.push(ev(ago(0.3), "Cancellation requested by customer.", "Customer"));
    orders.push(o);
  }
  // Shipped (Rohan)
  {
    const created = ago(4);
    const o = order({ id: "o-10228", number: "SVB-10228", learnerId: "l-rohan", createdAt: created, items: [item("b-mechanics-problem-solver", 1), item("b-electrostatics-workbook", 1)], status: "shipped" });
    o.payments = [pay(created + HOUR, o.total, "318876541190", "upi", { status: "approved", decidedBy: "Vikram Rao", decidedAt: ago(3.5) })];
    o.shipment = { mode: "courier", courier: "Delhivery", tracking: "DLV7734120985IN", dispatchedAt: ago(2), notes: "2 books, 1.4 kg" };
    o.events.push(ev(created + HOUR, "Payment details submitted (UPI ref 318876541190).", "Customer"));
    o.events.push(ev(ago(3.5), "Payment confirmed.", "Vikram Rao"), ev(ago(3.5), "Order moved to Processing.", "System"));
    o.events.push(ev(ago(2), "Shipped via Delhivery — tracking DLV7734120985IN.", "Priya Nair"));
    o.events.push(ev(ago(1), "In transit: reached Chennai hub.", "Priya Nair"));
    orders.push(o);
  }
  // Delivered 3 days ago — eligible for return (Sneha)
  {
    const created = ago(9);
    const o = order({ id: "o-10221", number: "SVB-10221", learnerId: "l-sneha", createdAt: created, items: [item("b-mht-cet-practice-papers", 1)], status: "delivered" });
    o.payments = [pay(created + HOUR, o.total, "702211934456", "upi", { status: "approved", decidedBy: "Arjun Das", decidedAt: ago(8.5) })];
    o.shipment = { mode: "courier", courier: "India Post (Speed Post)", tracking: "EM884512093IN", dispatchedAt: ago(7), deliveredAt: ago(3) };
    o.events.push(ev(created + HOUR, "Payment details submitted (UPI ref 702211934456).", "Customer"));
    o.events.push(ev(ago(8.5), "Payment confirmed.", "Arjun Das"), ev(ago(8.5), "Order moved to Processing.", "System"));
    o.events.push(ev(ago(7), "Shipped via India Post (Speed Post) — tracking EM884512093IN.", "Priya Nair"), ev(ago(3), "Delivered.", "Priya Nair"));
    orders.push(o);
  }
  // Delivered 12 days ago — return window closed (Rohan)
  {
    const created = ago(18);
    const o = order({ id: "o-10215", number: "SVB-10215", learnerId: "l-rohan", createdAt: created, items: [item("b-coordinate-geometry", 1), item("b-calculus-workbook", 1)], status: "delivered" });
    o.payments = [pay(created + 2 * HOUR, o.total, "318876500021", "upi", { status: "approved", decidedBy: "Priya Nair", decidedAt: ago(17.6) })];
    o.shipment = { mode: "self", courier: "StudyVerse dispatch", tracking: "SV-CHN-0915", dispatchedAt: ago(16), deliveredAt: ago(12) };
    o.events.push(ev(created + 2 * HOUR, "Payment details submitted (UPI ref 318876500021).", "Customer"));
    o.events.push(ev(ago(17.6), "Payment confirmed.", "Priya Nair"), ev(ago(17.6), "Order moved to Processing.", "System"));
    o.events.push(ev(ago(16), "Dispatched by StudyVerse — reference SV-CHN-0915.", "Priya Nair"), ev(ago(12), "Delivered.", "Priya Nair"));
    orders.push(o);
  }
  // Delivered, return requested — damaged (Ishita)
  {
    const created = ago(8);
    const o = order({ id: "o-10208", number: "SVB-10208", learnerId: "l-ishita", createdAt: created, items: [item("b-inorganic-revision-notes", 1)], status: "delivered" });
    o.payments = [pay(created + HOUR, o.total, "509931200871", "upi", { status: "approved", decidedBy: "Vikram Rao", decidedAt: ago(7.5) })];
    o.shipment = { mode: "courier", courier: "DTDC", tracking: "D44120877231", dispatchedAt: ago(6), deliveredAt: ago(2) };
    o.returnRequest = { requestedAt: ago(1), reason: "damaged", details: "The cover is torn and around 20 pages are water-damaged and stuck together.", photos: ["torn-cover.jpg", "water-damage.jpg"], preference: "replacement", status: "requested" };
    o.events.push(ev(created + HOUR, "Payment details submitted (UPI ref 509931200871).", "Customer"));
    o.events.push(ev(ago(7.5), "Payment confirmed.", "Vikram Rao"), ev(ago(7.5), "Order moved to Processing.", "System"));
    o.events.push(ev(ago(6), "Shipped via DTDC — tracking D44120877231.", "Priya Nair"), ev(ago(2), "Delivered.", "Priya Nair"));
    o.events.push(ev(ago(1), "Return requested: damaged in transit (replacement preferred).", "Customer"));
    orders.push(o);
  }
  // Returned — replacement sent and resolved (Ananya)
  {
    const created = ago(20);
    const o = order({ id: "o-10205", number: "SVB-10205", learnerId: "l-ananya", createdAt: created, items: [item("b-mechanics-problem-solver", 1)], status: "returned" });
    o.payments = [pay(created + HOUR, o.total, "NEFT-A55102938", "bank", { status: "approved", decidedBy: "Vikram Rao", decidedAt: ago(19.5) })];
    o.shipment = { mode: "courier", courier: "Blue Dart", tracking: "BD90311274IN", dispatchedAt: ago(18), deliveredAt: ago(15) };
    o.returnRequest = {
      requestedAt: ago(14), reason: "defective", details: "Pages 97–128 are printed twice and 129–160 are missing.", photos: ["duplicate-pages.jpg"], preference: "replacement",
      status: "resolved", decidedBy: "Arjun Das", decidedAt: ago(13), decisionNote: "Binding defect confirmed from photos. Sending a replacement copy.",
      replacement: { courier: "Blue Dart", tracking: "BD90388410IN", dispatchedAt: ago(12) }, resolvedAt: ago(9),
    };
    o.events.push(ev(created + HOUR, "Payment details submitted (bank ref NEFT-A55102938)."), ev(ago(19.5), "Payment confirmed.", "Vikram Rao"));
    o.events.push(ev(ago(18), "Shipped via Blue Dart — tracking BD90311274IN.", "Priya Nair"), ev(ago(15), "Delivered.", "Priya Nair"));
    o.events.push(ev(ago(14), "Return requested: printing/binding defect (replacement preferred).", "Customer"));
    o.events.push(ev(ago(13), "Return approved. Replacement will be sent.", "Arjun Das"));
    o.events.push(ev(ago(12), "Replacement shipped via Blue Dart — tracking BD90388410IN.", "Priya Nair"), ev(ago(9), "Return resolved.", "Arjun Das"));
    orders.push(o);
  }
  // Refunded after return (Tanvi)
  {
    const created = ago(16);
    const o = order({ id: "o-10203", number: "SVB-10203", learnerId: "l-tanvi", createdAt: created, items: [item("b-mht-cet-practice-papers-marathi", 1)], status: "refunded" });
    o.payments = [pay(created + HOUR, o.total, "509912340087", "upi", { status: "approved", decidedBy: "Arjun Das", decidedAt: ago(15.5) })];
    o.shipment = { mode: "courier", courier: "India Post (Speed Post)", tracking: "EM771230045IN", dispatchedAt: ago(14), deliveredAt: ago(11) };
    o.returnRequest = {
      requestedAt: ago(10), reason: "incorrect", details: "I ordered the Marathi edition but received the English edition.", photos: ["received-book.jpg"], preference: "refund",
      status: "resolved", decidedBy: "Arjun Das", decidedAt: ago(9), decisionNote: "Wrong edition shipped. Refunding in full as requested.", resolvedAt: ago(7),
    };
    o.refunds = [{ id: "rf-10203", amount: o.total, method: "upi", reference: "RFND-509912347781", status: "completed", context: "return", recordedBy: "Arjun Das", recordedAt: ago(8), completedAt: ago(7) }];
    o.events.push(ev(created + HOUR, "Payment details submitted (UPI ref 509912340087)."), ev(ago(15.5), "Payment confirmed.", "Arjun Das"));
    o.events.push(ev(ago(14), "Shipped via India Post (Speed Post) — tracking EM771230045IN.", "Priya Nair"), ev(ago(11), "Delivered.", "Priya Nair"));
    o.events.push(ev(ago(10), "Return requested: incorrect book received (refund preferred).", "Customer"));
    o.events.push(ev(ago(9), "Return approved. Refund will be issued.", "Arjun Das"));
    o.events.push(ev(ago(7), `Refund of ₹${o.total} completed via UPI (ref RFND-509912347781).`, "Arjun Das"));
    orders.push(o);
  }
  // Cancelled before payment (Vihaan)
  {
    const created = ago(6);
    const o = order({ id: "o-10219", number: "SVB-10219", learnerId: "l-vihaan", createdAt: created, items: [item("b-jee-advanced-mock-papers", 1)], status: "cancelled" });
    o.cancellation = { requestedAt: ago(5.8), reason: "Ordered by mistake — I wanted the Hindi edition.", status: "approved", decidedAt: ago(5.8), decidedBy: "Customer" };
    o.events.push(ev(ago(5.8), "Order cancelled by customer before payment. Reserved stock released.", "Customer"));
    orders.push(o);
  }

  // Inventory history
  let mvSeq = 0;
  const mv = (bookId: string, daysAgo: number, delta: number, kind: StockMovement["kind"], reason: string, actor: string, orderId?: string): StockMovement => ({
    id: `mv-${++mvSeq}`, bookId, at: ago(daysAgo), delta, kind, reason, actor, orderId,
  });
  const stockMovements: StockMovement[] = [
    mv("b-mechanics-problem-solver", 30, 60, "added", "Received printer consignment #PR-2210", "Priya Nair"),
    mv("b-mechanics-problem-solver", 3.5, -1, "sale", "Order SVB-10228 payment confirmed", "System", "o-10228"),
    mv("b-mechanics-problem-solver", 12, -1, "replacement", "Replacement copy for SVB-10205", "Priya Nair", "o-10205"),
    mv("b-mechanics-problem-solver", 9, -2, "damaged", "Water damage in storage rack B", "Priya Nair"),
    mv("b-organic-mechanism-maps", 20, 25, "added", "Reprint batch received", "Priya Nair"),
    mv("b-organic-mechanism-maps", 6, -3, "correction", "Physical count found 3 fewer copies than system", "Vikram Rao"),
    mv("b-jee-main-solved-papers", 40, 150, "added", "2027 edition launch stock", "Vikram Rao"),
    mv("b-jee-main-solved-papers", 2, -4, "damaged", "Binding defect batch returned to printer", "Priya Nair"),
    mv("b-physical-chemistry-drills", 1.8, 0, "correction", "Stock check: no copies on hand; restock ordered", "Priya Nair"),
    mv("b-pcm-formula-handbook", 15, 200, "added", "5th edition stock", "Priya Nair"),
    mv("b-electrostatics-workbook", 18, 40, "added", "New title launch stock", "Priya Nair"),
    mv("b-inorganic-revision-notes", 7.5, -1, "sale", "Order SVB-10208 payment confirmed", "System", "o-10208"),
  ];

  const n = (learnerId: string, daysAgo: number, title: string, body: string, href: string, read = false): AppNotification => ({
    id: `nt-${learnerId}-${title.length}-${daysAgo}`, learnerId, at: ago(daysAgo), title, body, href, read, email: true,
  });
  const notifications: AppNotification[] = [
    n("l-rohan", 1, "Order SVB-10228 is on its way", "Shipped via Delhivery — tracking DLV7734120985IN.", "/dashboard/orders/o-10228"),
    n("l-rohan", 3.5, "Payment approved for SVB-10228", "Your payment was verified and the order is now being processed.", "/dashboard/orders/o-10228", true),
    n("l-rohan", 12, "Order SVB-10215 delivered", "Enjoy your books! Report any damage within 7 days of delivery.", "/dashboard/orders/o-10215", true),
    n("l-aarav", 10 / 24 - 4 / 24, "Payment rejected for SVB-10233", "We couldn't verify your payment. Check the reason and resubmit.", "/dashboard/orders/o-10233"),
    n("l-diya", 7 / 24 - 40 / 1440, "Payment details received for SVB-10238", "We're verifying your payment. This usually takes a few hours.", "/dashboard/orders/o-10238"),
    n("l-sneha", 3, "Order SVB-10221 delivered", "Report any damaged, defective or incorrect book within 7 days.", "/dashboard/orders/o-10221"),
    n("l-tanvi", 7, "Refund completed for SVB-10203", "Your refund was sent via UPI (ref RFND-509912347781).", "/dashboard/orders/o-10203"),
  ];

  return {
    books,
    bookOrders: orders.sort((a, b) => b.createdAt - a.createdAt),
    addresses,
    stockMovements,
    carts: { "l-rohan": [{ bookId: "b-calculus-workbook", qty: 1, addedAt: anchor - 2 * HOUR }] },
    notifications,
    bookstore: settings,
  };
}
