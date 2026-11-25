import type { Metadata } from "next";
import { CheckoutPage } from "@/features/bookstore/cart-checkout";

export const metadata: Metadata = { title: "Checkout" };

export default function Page() {
  return <CheckoutPage />;
}
