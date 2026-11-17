import type { Metadata } from "next";
import { OrdersAdminPage } from "@/features/admin/bookstore-orders";

export const metadata: Metadata = { title: "Bookstore orders" };

export default function Page() {
  return <OrdersAdminPage />;
}
