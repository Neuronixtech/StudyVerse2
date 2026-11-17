import type { Metadata } from "next";
import { CartPage } from "@/features/bookstore/cart-checkout";

export const metadata: Metadata = { title: "Cart" };

export default function Page() {
  return <CartPage />;
}
