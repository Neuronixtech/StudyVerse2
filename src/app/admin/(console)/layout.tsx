import type { Metadata } from "next";
import { AdminShell } from "@/features/admin/admin-shell";

export const metadata: Metadata = {
  title: { default: "Admin console", template: "%s · StudyVerse Admin" },
};

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
