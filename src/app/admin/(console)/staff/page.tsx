import type { Metadata } from "next";
import { StaffPage } from "@/features/admin/admin-settings";

export const metadata: Metadata = { title: "Admins & staff" };

export default function Page() {
  return <StaffPage />;
}
