"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, FlaskConical, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/lib/hooks";
import { ADMIN_PERSONAS } from "@/lib/mock/seed";
import { loginAdmin } from "@/lib/store";
import { isValidEmail } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AdminLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useSession();
  const rawNext = params.get("next");
  const next = rawNext && rawNext.startsWith("/admin") ? rawNext : "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const enter = (id: string) => {
    const admin = state.admins.find((a) => a.id === id)!;
    loginAdmin(id);
    toast({ title: `Signed in as ${admin.name}`, description: admin.role === "owner" ? "Owner" : "Staff admin", simulated: true });
    router.replace(next);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!isValidEmail(email)) errs.email = "Enter your work email";
    if (password.length < 6) errs.password = "Enter your password (6+ characters)";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const admin = state.admins.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
      if (!admin) return setErrors({ form: "This email isn't registered as a StudyVerse admin. Admin accounts are created by owner invitation only." });
      enter(admin.id);
    }, 600);
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink p-4">
      <div className="bg-grid-faint absolute inset-0 opacity-30" />
      <div className="absolute -top-32 -left-32 size-96 rounded-full bg-brand-600/30 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Logo light suffix="Admin" />
          <div className="flex items-center gap-1">
            <ThemeToggle tone="onDark" />
            <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white">
              <ArrowLeft className="size-4" /> Site
            </Link>
          </div>
        </div>
        <div className="rounded-2xl bg-surface p-6 shadow-2xl sm:p-8">
          <span className="grid size-12 place-items-center rounded-xl bg-ink text-white">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold">Admin console</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with the email your owner invited. There is no public admin registration.</p>
          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            {errors.form && <Callout tone="danger">{errors.form}</Callout>}
            <Field label="Work email" error={errors.email} required>
              {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@studyverse.example" autoComplete="username" />}
            </Field>
            <Field label="Password" error={errors.password} required>
              {(p) => <Input {...p} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
            </Field>
            <Button type="submit" block size="lg" loading={loading} variant="dark">
              Sign in
            </Button>
          </form>
          <div className="mt-6 rounded-xl border border-dashed border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-amber-900 dark:text-amber-100 uppercase">
              <FlaskConical className="size-3.5" /> Demo admin accounts
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {ADMIN_PERSONAS.map((p) => {
                const a = state.admins.find((x) => x.id === p.id);
                if (!a) return null;
                return (
                  <button key={p.id} type="button" onClick={() => enter(a.id)} className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-surface px-3 py-2 text-left hover:border-brand-400">
                    <span className="block text-sm font-semibold text-fg">{a.name}</span>
                    <span className="block text-xs text-slate-500">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
