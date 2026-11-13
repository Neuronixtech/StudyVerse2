import type { Metadata } from "next";
import { AdminProfilePage } from "@/features/admin/admin-settings";

export const metadata: Metadata = { title: "Account settings" };

export default function Page() {
  return <AdminProfilePage />;
}
