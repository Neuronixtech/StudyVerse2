import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { LoginForm } from "@/features/auth/auth-forms";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <LoginForm />
    </Suspense>
  );
}
