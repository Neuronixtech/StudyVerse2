import type { Metadata } from "next";
import { SubscriptionsPage } from "@/features/admin/admin-subscriptions";

export const metadata: Metadata = { title: "Subscriptions" };

export default function Page() {
  return <SubscriptionsPage />;
}
