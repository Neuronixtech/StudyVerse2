import type { Metadata } from "next";
import { DispatchPage } from "@/features/admin/bookstore-ops";

export const metadata: Metadata = { title: "Dispatch" };

export default function Page() {
  return <DispatchPage />;
}
