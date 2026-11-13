import type { Metadata } from "next";
import { ProfileSettings } from "@/features/dashboard/dashboard-pages";

export const metadata: Metadata = { title: "Profile & settings" };

export default function Page() {
  return <ProfileSettings />;
}
