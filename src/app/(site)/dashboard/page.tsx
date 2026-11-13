import type { Metadata } from "next";
import { DashboardOverview } from "@/features/dashboard/dashboard-pages";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return <DashboardOverview />;
}
