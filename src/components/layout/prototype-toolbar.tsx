"use client";

import Link from "next/link";
import { useState } from "react";
import { FlaskConical, RotateCcw, ShieldCheck, UserRound, X } from "lucide-react";
import { useSession } from "@/lib/hooks";
import { ADMIN_PERSONAS, LEARNER_PERSONAS } from "@/lib/mock/seed";
import { loginAdmin, loginLearner, logoutAdmin, logoutLearner, resetPrototype, setPrefs } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Switch } from "../ui/form";
import { ConfirmDialog } from "../ui/modal";
import { toast } from "../ui/toast";

const toneDot = { slate: "bg-slate-400", amber: "bg-amber-500", green: "bg-emerald-500", red: "bg-red-500" };

/**
 * Floating reviewer toolbar: switch personas, simulate latency/errors and
 * reset mock data. Exists only because this is a UI prototype.
 */
export function PrototypeToolbar({ sidebarOffset }: { sidebarOffset?: boolean } = {}) {
  const { state, learner, admin } = useSession();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const learnerName = (id: string) => state.learners.find((l) => l.id === id)?.name ?? id;
  const adminName = (id: string) => state.admins.find((a) => a.id === id)?.name ?? id;

  return (
    <>
      <div className={cn("fixed bottom-4 left-4 z-50 print:hidden", sidebarOffset && "lg:left-[17rem]")}>
        {open ? (
          <div
            role="dialog"
            aria-label="Prototype controls"
            className="w-[min(22rem,calc(100vw-2rem))] animate-slide-up overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
              <p className="flex items-center gap-2 text-sm font-bold">
                <FlaskConical className="size-4 text-amber-300" /> Prototype controls
              </p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-white/10" aria-label="Close prototype controls">
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[70dvh] space-y-5 overflow-y-auto p-4">
              <p className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-100 ring-1 ring-amber-200 dark:ring-amber-500/30">
                UI prototype with mock data. Sign-in, payments and approvals are simulated and saved only in this browser. Open the admin console in another tab to see learner screens update live.
              </p>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  <UserRound className="size-3.5" /> Learner view
                </h3>
                <div className="grid gap-1.5">
                  <PersonaButton
                    active={!learner}
                    onClick={() => {
                      logoutLearner();
                      toast({ title: "Viewing as visitor", tone: "info" });
                    }}
                    label="Visitor"
                    hint="Not signed in"
                    dot="bg-slate-300"
                  />
                  {LEARNER_PERSONAS.map((p) => (
                    <PersonaButton
                      key={p.id}
                      active={learner?.id === p.id}
                      onClick={() => {
                        loginLearner(p.id);
                        toast({ title: `Signed in as ${learnerName(p.id)}`, description: p.label, tone: "info", simulated: true });
                      }}
                      label={learnerName(p.id)}
                      hint={p.label}
                      dot={toneDot[p.tone]}
                    />
                  ))}
                  {learner && !LEARNER_PERSONAS.some((p) => p.id === learner.id) && (
                    <PersonaButton active onClick={() => undefined} label={learner.name} hint="Your new account" dot="bg-brand-500" />
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  <ShieldCheck className="size-3.5" /> Admin session
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  <SmallToggle active={!admin} onClick={() => logoutAdmin()}>
                    Signed out
                  </SmallToggle>
                  {ADMIN_PERSONAS.map((p) => (
                    <SmallToggle
                      key={p.id}
                      active={admin?.id === p.id}
                      onClick={() => {
                        loginAdmin(p.id);
                        toast({ title: `Admin: ${adminName(p.id)}`, description: p.label, tone: "info", simulated: true });
                      }}
                    >
                      {p.label}
                    </SmallToggle>
                  ))}
                </div>
                <Link href="/admin" className="mt-2 inline-block text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline" onClick={() => setOpen(false)}>
                  Open admin console →
                </Link>
              </section>

              <section className="space-y-3">
                <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Simulate states</h3>
                <Switch
                  checked={state.prefs.simulateLatency}
                  onChange={(v) => setPrefs({ simulateLatency: v })}
                  label="Slow network"
                  description="Catalog and list views show loading skeletons."
                />
                <Switch
                  checked={state.prefs.simulateError}
                  onChange={(v) => setPrefs({ simulateError: v })}
                  label="Request errors"
                  description="Catalog and list views fail until you retry."
                />
              </section>

              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="size-4" /> Reset all mock data
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full bg-ink py-2 pr-3.5 pl-2.5 text-xs font-bold text-white shadow-xl ring-4 ring-white/70 transition-transform hover:scale-105"
            aria-label="Open prototype controls"
          >
            <span className="grid size-6 place-items-center rounded-full bg-amber-400 text-ink">
              <FlaskConical className="size-3.5" />
            </span>
            Prototype
            <span className="hidden max-w-32 truncate font-medium text-white/60 sm:inline">· {learner ? learner.name.split(" ")[0] : "Visitor"}</span>
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetPrototype();
          setConfirmReset(false);
          toast({ title: "Mock data reset", description: "Courses, tests, learners and requests are back to their defaults.", simulated: true });
        }}
        tone="danger"
        title="Reset all mock data?"
        description="This clears every change you've made in this browser — new accounts, requests, approvals, attempts and admin edits."
        confirmLabel="Reset data"
      />
    </>
  );
}

function PersonaButton({ active, onClick, label, hint, dot }: { active: boolean; onClick: () => void; label: string; hint: string; dot: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
        active ? "border-brand-500 bg-brand-50 dark:bg-brand-400/10" : "border-line hover:border-brand-200 dark:hover:border-brand-400/30 hover:bg-slate-50",
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", dot)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      {active && <span className="text-[10px] font-bold tracking-wide text-brand-700 dark:text-brand-300 uppercase">Current</span>}
    </button>
  );
}

function SmallToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
        active ? "border-brand-500 bg-brand-50 dark:bg-brand-400/10 text-brand-800 dark:text-brand-200" : "border-line text-slate-600 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}
