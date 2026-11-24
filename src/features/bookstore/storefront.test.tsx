import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookCatalog } from "./storefront";

/* ---------------------------- Next.js mocks ---------------------------- */

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

/* -------------------------- Data-layer mocks --------------------------- */

vi.mock("@/lib/hooks", () => ({
  useSession: vi.fn(),
  useSimulatedLoad: vi.fn(),
}));

import { useSession, useSimulatedLoad } from "@/lib/hooks";

beforeEach(() => {
  searchString = "";
  vi.mocked(useSimulatedLoad).mockReturnValue({ status: "success", retry: vi.fn() });
  vi.mocked(useSession).mockReturnValue({
    state: { books: [], bookOrders: [], bookstore: {} },
    now: 0,
  } as unknown as ReturnType<typeof useSession>);
});

describe("BookCatalog (smoke test)", () => {
  it("renders the page heading", () => {
    render(<BookCatalog />);
    expect(screen.getByRole("heading", { level: 1, name: "All books" })).toBeInTheDocument();
  });
});
