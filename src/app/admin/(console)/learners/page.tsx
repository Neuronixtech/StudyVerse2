import type { Metadata } from "next";
import { LearnersPage } from "@/features/admin/admin-learners";

export const metadata: Metadata = { title: "Learners" };

export default function Page() {
  return <LearnersPage />;
}
