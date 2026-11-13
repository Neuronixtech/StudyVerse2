import type { Metadata } from "next";
import { MySubscription } from "@/features/dashboard/dashboard-pages";

export const metadata: Metadata = { title: "Subscription" };

export default function Page() {
  return <MySubscription />;
}
