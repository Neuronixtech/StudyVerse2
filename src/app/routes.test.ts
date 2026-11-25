// @vitest-environment node
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_BOOK_SLUGS } from "@/lib/bookstore";

/** Every URL pattern the App Router serves, derived from the files in src/app (route groups stripped). */
function routeTable(): { url: string; file: string }[] {
  const appDir = join(process.cwd(), "src", "app");
  const out: { url: string; file: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx" || name === "route.ts") {
        const segs = relative(appDir, dir).split(sep).filter((s) => s && !/^\(.*\)$/.test(s));
        out.push({ url: `/${segs.join("/")}`, file: relative(process.cwd(), full) });
      }
    }
  };
  walk(appDir);
  return out.sort((a, b) => a.url.localeCompare(b.url));
}

const siblingsOf = (urls: string[], parent: string) =>
  [...new Set(urls.filter((u) => u.startsWith(`${parent}/`)).map((u) => u.slice(parent.length + 1).split("/")[0]))];

describe("route table", () => {
  const routes = routeTable();
  const urls = routes.map((r) => r.url);

  it("serves the expected 54 routes", () => {
    expect(routes).toHaveLength(54);
  });

  it("has no two files resolving to the same URL", () => {
    const dupes = urls.filter((u, i) => urls.indexOf(u) !== i);
    expect(dupes).toEqual([]);
  });

  it("never uses two different dynamic names at the same level (e.g. [slug] beside [id])", () => {
    const parents = new Set(urls.flatMap((u) => u.split("/").map((_, i, a) => a.slice(0, i).join("/"))));
    const conflicts = [...parents].filter((p) => siblingsOf(urls, p).filter((s) => s.startsWith("[")).length > 1);
    expect(conflicts).toEqual([]);
  });

  it("keeps all bookstore administration under /admin/bookstore", () => {
    const adminBookstore = routes.filter((r) => r.file.includes(`${sep}bookstore${sep}`) || r.file.endsWith(`${sep}bookstore${sep}page.tsx`));
    expect(adminBookstore.filter((r) => r.file.includes("admin")).every((r) => r.url.startsWith("/admin/bookstore"))).toBe(true);
    expect(urls.filter((u) => u.startsWith("/books"))).toEqual([
      "/books",
      "/books/[slug]",
      "/books/cart",
      "/books/catalog",
      "/books/checkout",
      "/books/orders/[orderId]/payment",
    ]);
  });

  it("reserves every static /books/* segment so no book slug can be shadowed", () => {
    const staticSiblings = siblingsOf(urls, "/books").filter((s) => !s.startsWith("["));
    expect([...RESERVED_BOOK_SLUGS].sort()).toEqual(staticSiblings.sort());
  });

  it("only uses 'new' beside an id segment whose generated ids can never equal 'new'", () => {
    // ids come from uid("c" | "t" | "b") → "c-xxxx", so /admin/*/new can't collide with an id
    const withNew = [...new Set(urls.filter((u) => u.endsWith("/new")).map((u) => u.slice(0, -4)))].sort();
    expect(withNew).toEqual(["/admin/bookstore/books", "/admin/courses", "/admin/tests"]);
  });
});
