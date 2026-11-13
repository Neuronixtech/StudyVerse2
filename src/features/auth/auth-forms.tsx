"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, CircleCheck, Eye, EyeOff, FlaskConical, MailCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/lib/hooks";
import { EXAMS } from "@/lib/mock/catalog";
import { LEARNER_PERSONAS } from "@/lib/mock/seed";
import { claimAttempt, loginLearner, signupLearner } from "@/lib/store";
import type { ExamId } from "@/lib/types";
import { cn, isValidEmail, isValidIndianPhone } from "@/lib/utils";

function safeNext(next: string | null, fallback = "/dashboard") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function GoogleButton() {
  return (
    <Button variant="secondary" block disabled title="Google sign-in is not connected in the prototype">
      <span className="grid size-5 place-items-center rounded-full bg-slate-100 text-[11px] font-black text-slate-500">G</span>
      Continue with Google
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Not in prototype</span>
    </Button>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-medium text-slate-400">
      <span className="h-px flex-1 bg-line" /> {label} <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/* ------------------------------- Login ------------------------------- */

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useSession();
  const next = safeNext(params.get("next"));
  const claim = params.get("claim");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const complete = (learnerId: string, name: string) => {
    loginLearner(learnerId);
    if (claim) claimAttempt(claim, learnerId);
    toast({ title: `Welcome back, ${name.split(" ")[0]}!`, description: claim ? "Your demo result was saved to your history." : undefined, simulated: true });
    router.replace(next);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = "Enter your email address";
    else if (!isValidEmail(email)) errs.email = "Enter a valid email address";
    if (!password) errs.password = "Enter your password";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setTimeout(() => {
      const learner = state.learners.find((l) => l.email.toLowerCase() === email.trim().toLowerCase());
      setLoading(false);
      if (!learner) {
        setErrors({ form: "We couldn't find an account with that email." });
        return;
      }
      complete(learner.id, learner.name);
    }, 650);
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Log in</h1>
      <p className="mt-2 text-slate-500">
        New to StudyVerse?{" "}
        <Link href={`/signup${params.size ? `?${params}` : ""}`} className="font-semibold text-brand-700 hover:underline">
          Create a free account
        </Link>
      </p>

      {claim && (
        <Callout tone="brand" className="mt-6">
          Log in to save your demo test result to your history.
        </Callout>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {errors.form && (
          <Callout tone="danger" title={errors.form}>
            Check the spelling, or{" "}
            <Link href="/signup" className="font-semibold underline">
              sign up
            </Link>{" "}
            for a new account. Try a demo account below.
          </Callout>
        )}
        <Field label="Email address" error={errors.email} required>
          {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />}
        </Field>
        <Field
          label={
            <span className="flex items-center justify-between">
              Password
              <Link href="/forgot-password" className="text-xs font-semibold text-brand-700 hover:underline">
                Forgot password?
              </Link>
            </span>
          }
          error={errors.password}
          required
        >
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />}
        </Field>
        <Button type="submit" block size="lg" loading={loading}>
          Log in <ArrowRight />
        </Button>
      </form>

      <Divider label="or" />
      <GoogleButton />

      <div className="mt-8 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
        <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-amber-900 uppercase">
          <FlaskConical className="size-3.5" /> Demo learner accounts
        </p>
        <p className="mt-1 text-xs text-amber-900/80">Sign-in is simulated. Pick a persona to explore each subscription state.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LEARNER_PERSONAS.map((p) => {
            const l = state.learners.find((x) => x.id === p.id);
            if (!l) return null;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => complete(l.id, l.name)}
                className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-left transition-colors hover:border-brand-400"
              >
                <span className="block text-sm font-semibold text-ink">{l.name}</span>
                <span className="block text-xs text-slate-500">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Are you an admin?{" "}
        <Link href="/admin/login" className="font-semibold text-brand-700 hover:underline">
          Admin console login
        </Link>
      </p>
    </div>
  );
}

/* ------------------------------- Signup ------------------------------- */

interface SignupValues {
  name: string;
  email: string;
  phone: string;
  targetExam: ExamId;
  targetYear: string;
  password: string;
  confirm: string;
  terms: boolean;
}

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useSession();
  const next = safeNext(params.get("next"));
  const claim = params.get("claim");
  const [v, setV] = useState<SignupValues>({ name: "", email: "", phone: "", targetExam: "jee-main", targetYear: "2027", password: "", confirm: "", terms: false });
  const [errors, setErrors] = useState<Partial<Record<keyof SignupValues, string>>>({});
  const [loading, setLoading] = useState(false);
  const set = <K extends keyof SignupValues>(k: K, val: SignupValues[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const strength = [/.{8,}/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(v.password)).length;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (v.name.trim().length < 2) errs.name = "Enter your full name";
    if (!isValidEmail(v.email)) errs.email = "Enter a valid email address";
    else if (state.learners.some((l) => l.email.toLowerCase() === v.email.trim().toLowerCase())) errs.email = "An account with this email already exists — log in instead";
    if (!isValidIndianPhone(v.phone)) errs.phone = "Enter a valid 10-digit Indian mobile number";
    if (v.password.length < 8) errs.password = "Use at least 8 characters";
    if (v.confirm !== v.password) errs.confirm = "Passwords don't match";
    if (!v.terms) errs.terms = "Please accept the terms to continue";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setTimeout(() => {
      const id = signupLearner({
        name: v.name.trim(),
        email: v.email.trim().toLowerCase(),
        phone: v.phone.trim(),
        city: "",
        targetExam: v.targetExam,
        targetYear: Number(v.targetYear),
      });
      if (claim) claimAttempt(claim, id);
      toast({ title: "Account created", description: claim ? "Your demo result was saved to your history." : "Welcome to StudyVerse!", simulated: true });
      router.replace(next);
    }, 700);
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Create your account</h1>
      <p className="mt-2 text-slate-500">
        Already have one?{" "}
        <Link href={`/login${params.size ? `?${params}` : ""}`} className="font-semibold text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
      {claim && (
        <Callout tone="brand" className="mt-6">
          Your demo test result will be saved to your new account.
        </Callout>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        <Field label="Full name" error={errors.name} required>
          {(p) => <Input {...p} autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ananya Sharma" />}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" error={errors.email} required>
            {(p) => <Input {...p} type="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />}
          </Field>
          <Field label="Mobile number" error={errors.phone} required>
            {(p) => <Input {...p} type="tel" autoComplete="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98765 43210" />}
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Preparing for">
            {(p) => (
              <Select {...p} value={v.targetExam} onChange={(e) => set("targetExam", e.target.value as ExamId)}>
                {EXAMS.filter((x) => !x.comingSoon).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Exam year">
            {(p) => (
              <Select {...p} value={v.targetYear} onChange={(e) => set("targetYear", e.target.value)}>
                {["2027", "2028", "2029"].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Password" error={errors.password} hint="At least 8 characters. Mix letters, numbers and symbols." required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={v.password} onChange={(e) => set("password", e.target.value)} />}
        </Field>
        {v.password && (
          <div className="-mt-1 flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < strength ? (strength <= 1 ? "bg-red-500" : strength <= 2 ? "bg-amber-500" : "bg-emerald-500") : "bg-slate-200")} />
              ))}
            </div>
            <span className="text-xs font-semibold text-slate-500">{["Very weak", "Weak", "Fair", "Good", "Strong"][strength]}</span>
          </div>
        )}
        <Field label="Confirm password" error={errors.confirm} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={v.confirm} onChange={(e) => set("confirm", e.target.value)} />}
        </Field>
        <div>
          <Checkbox
            checked={v.terms}
            onChange={(e) => set("terms", e.target.checked)}
            label="I agree to the Terms of Use and Privacy Policy"
            description="Prototype only — no account is created on a server."
            aria-invalid={errors.terms ? true : undefined}
          />
          {errors.terms && <p className="mt-1.5 ml-7 text-xs font-medium text-red-600">{errors.terms}</p>}
        </div>
        <Button type="submit" block size="lg" loading={loading}>
          Create account <ArrowRight />
        </Button>
      </form>
      <Divider label="or" />
      <GoogleButton />
      <p className="mt-6 text-center text-xs text-slate-500">Email verification and OTP are not part of the UI prototype.</p>
    </div>
  );
}

/* --------------------------- Forgot / reset --------------------------- */

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <MailCheck className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">Check your inbox</h1>
        <p className="mt-2 text-slate-500">
          If an account exists for <strong className="text-ink">{email}</strong>, you&apos;ll receive a link to reset your password.
        </p>
        <Callout tone="warning" className="mt-6 text-left" icon={<FlaskConical />} title="Prototype: no email is sent">
          Use the button below to open the reset screen directly.
        </Callout>
        <div className="mt-6 grid gap-2">
          <ButtonLink href={`/reset-password?email=${encodeURIComponent(email)}`} block>
            Open reset link (simulated)
          </ButtonLink>
          <ButtonLink href="/login" variant="ghost" block>
            Back to log in
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Forgot password?</h1>
      <p className="mt-2 text-slate-500">Enter the email linked to your account and we&apos;ll send you a reset link.</p>
      <form
        noValidate
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isValidEmail(email)) return setError("Enter a valid email address");
          setError(null);
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
            setSent(true);
          }, 700);
        }}
      >
        <Field label="Email address" error={error} required>
          {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />}
        </Field>
        <Button type="submit" block size="lg" loading={loading}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ pw?: string; confirm?: string }>({});
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (done) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CircleCheck className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">Password updated</h1>
        <p className="mt-2 text-slate-500">You can now log in with your new password.</p>
        <ButtonLink href="/login" block className="mt-6">
          Go to log in
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Set a new password</h1>
      <p className="mt-2 text-slate-500">{params.get("email") ? <>For {params.get("email")}. </> : null}Choose a strong password you haven&apos;t used before.</p>
      <form
        noValidate
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const errs: typeof errors = {};
          if (pw.length < 8) errs.pw = "Use at least 8 characters";
          if (confirm !== pw) errs.confirm = "Passwords don't match";
          setErrors(errs);
          if (Object.keys(errs).length) return;
          setLoading(true);
          setTimeout(() => {
            setLoading(false);
            setDone(true);
            toast({ title: "Password updated", simulated: true });
          }, 700);
        }}
      >
        <Field label="New password" error={errors.pw} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
        </Field>
        <Field label="Confirm new password" error={errors.confirm} required>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <Button type="submit" block size="lg" loading={loading}>
          Update password
        </Button>
      </form>
    </div>
  );
}
