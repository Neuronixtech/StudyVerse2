import type { Metadata } from "next";
import { MyOrders } from "@/features/bookstore/my-orders";

export const metadata: Metadata = { title: "My book orders" };

export default function Page() {
  return <MyOrders />;
}
