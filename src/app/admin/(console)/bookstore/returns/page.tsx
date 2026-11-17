import type { Metadata } from "next";
import { ReturnsPage } from "@/features/admin/bookstore-ops";

export const metadata: Metadata = { title: "Returns & refunds" };

export default function Page() {
  return <ReturnsPage />;
}
