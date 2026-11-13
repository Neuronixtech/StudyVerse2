import type { Metadata } from "next";
import { AttemptHistory } from "@/features/dashboard/dashboard-pages";

export const metadata: Metadata = { title: "Attempt history" };

export default function Page() {
  return <AttemptHistory />;
}
