import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { SignupForm } from "@/features/auth/auth-forms";

export const metadata: Metadata = { title: "Sign up" };

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <SignupForm />
    </Suspense>
  );
}
