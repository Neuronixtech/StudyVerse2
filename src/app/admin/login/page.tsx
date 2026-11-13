import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLogin } from "@/features/admin/admin-login";

export const metadata: Metadata = { title: "Admin login" };

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      <AdminLogin />
    </Suspense>
  );
}
