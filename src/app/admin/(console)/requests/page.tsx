import type { Metadata } from "next";
import { RequestsPage } from "@/features/admin/admin-subscriptions";

export const metadata: Metadata = { title: "Activation requests" };

export default function Page() {
  return <RequestsPage />;
}
