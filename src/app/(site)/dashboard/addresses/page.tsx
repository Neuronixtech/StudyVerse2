import type { Metadata } from "next";
import { AddressesPage } from "@/features/bookstore/my-orders";

export const metadata: Metadata = { title: "Saved addresses" };

export default function Page() {
  return <AddressesPage />;
}
