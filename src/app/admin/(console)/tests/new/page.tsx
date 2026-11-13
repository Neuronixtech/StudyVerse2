import type { Metadata } from "next";
import { TestCreatePage } from "@/features/admin/admin-tests";

export const metadata: Metadata = { title: "New test" };

export default function Page() {
  return <TestCreatePage />;
}
