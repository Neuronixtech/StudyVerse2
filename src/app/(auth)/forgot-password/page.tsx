import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/auth-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return <ForgotPasswordForm />;
}
