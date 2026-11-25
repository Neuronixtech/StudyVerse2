"use client";

import { useState, type FormEvent } from "react";
import { Copy, Crown, Lock, LogOut, Mail, Plus, Send, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, Callout, Card, CardHeader, PageHeader, SimulatedNote } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { hasPermission, PERMISSION_HINT, PERMISSION_LABEL } from "@/lib/access";
import { useSession } from "@/lib/hooks";
import {
  inviteAdmin,
  logoutAdmin,
  removeAdmin,
  setDemoTest,
  updateAdminPermissions,
  updateAdminProfile,
  updatePaymentSettings,
  updatePlans,
  updatePlatformSettings,
} from "@/lib/store";
import type { Admin, PaymentSettings, Permission, Plan, PlatformSettings } from "@/lib/types";
import { formatINR, isValidEmail, relativeTime } from "@/lib/utils";
import { Restricted } from "./admin-shell";

const ALL_PERMS: Permission[] = ["courses", "tests", "learners", "subscriptions", "pricing"];

/* ------------------------------ Staff ------------------------------ */

export function StaffPage() {
  const { state, admin, now } = useSession();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [removing, setRemoving] = useState<Admin | null>(null);
  if (!admin) return null;
  if (admin.role !== "owner") return <Restricted what="admins and staff permissions" ownerOnly />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admins & staff"
        description="Admin accounts are created by owner invitation only. Staff can be granted operational permissions but can never manage admins or owner settings."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <Plus /> Invite admin
          </Button>
        }
      />
      <Card>
        <ul className="divide-y divide-line">
          {state.admins.map((a) => (
            <li key={a.id} className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={a.name} size="lg" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-fg">
                    {a.name}
                    {a.id === admin.id && <span className="text-xs font-medium text-slate-400">(you)</span>}
                    <Badge tone={a.role === "owner" ? "violet" : "sky"} size="xs">
                      {a.role === "owner" ? (
                        <>
                          <Crown /> Owner
                        </>
                      ) : (
                        "Staff"
                      )}
                    </Badge>
                    {a.status === "invited" && (
                      <Badge tone="amber" size="xs">
                        Invitation pending
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-sm text-slate-500">{a.email}</p>
                  <p className="text-xs text-slate-400">{a.status === "invited" ? `Invited ${relativeTime(a.invitedAt, now)}` : a.lastActiveAt ? `Last active ${relativeTime(a.lastActiveAt, now)}` : "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:w-[360px]">
                {a.role === "owner" ? (
                  // A sentence, not a label: allow wrapping (Badge is nowrap by default) so it fits at 320 px
                  <Badge tone="violet" className="whitespace-normal!">Full access, including admins & platform settings</Badge>
                ) : a.permissions.length ? (
                  a.permissions.map((p) => (
                    <Badge key={p} tone="slate" size="xs">
                      {PERMISSION_LABEL[p]}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No permissions</span>
                )}
              </div>
              {a.role !== "owner" && (
                <div className="flex flex-wrap gap-2">
                  {a.status === "invited" && (
                    <Button variant="ghost" size="sm" onClick={() => toast({ title: "Invitation re-sent", description: a.email, simulated: true })}>
                      <Send /> Resend
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setEditing(a)}>
                    <UserCog /> Permissions
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300" onClick={() => setRemoving(a)} aria-label={`Remove ${a.name}`}>
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <PermissionsDialog key={editing?.id ?? "none"} admin={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removeAdmin(removing.id, admin.id);
          toast({ title: `${removing?.name} removed`, simulated: true });
          setRemoving(null);
        }}
        tone="danger"
        title={`Remove ${removing?.name}?`}
        description="They will immediately lose access to the admin console. Their past actions remain in the activity log."
        confirmLabel="Remove admin"
      />
    </div>
  );
}

function PermissionChecklist({ value, onChange }: { value: Permission[]; onChange: (v: Permission[]) => void }) {
  return (
    <div className="space-y-3">
      {ALL_PERMS.map((p) => (
        <Checkbox
          key={p}
          checked={value.includes(p)}
          onChange={() => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p])}
          label={PERMISSION_LABEL[p]}
          description={PERMISSION_HINT[p]}
        />
      ))}
      <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <Lock className="size-3.5" /> Managing admins and owner platform settings is never available to staff.
      </p>
    </div>
  );
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, admin } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState<Permission[]>(["courses", "tests"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [link, setLink] = useState<string | null>(null);

  const close = () => {
    setName("");
    setEmail("");
    setPerms(["courses", "tests"]);
    setErrors({});
    setLink(null);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Enter their name";
    if (!isValidEmail(email)) errs.email = "Enter a valid email";
    else if (state.admins.some((a) => a.email.toLowerCase() === email.trim().toLowerCase())) errs.email = "This email already has admin access";
    setErrors(errs);
    if (Object.keys(errs).length || !admin) return;
    const id = inviteAdmin({ name: name.trim(), email: email.trim().toLowerCase(), permissions: perms }, admin.id);
    setLink(`https://studyverse.example/admin/invite/${id}`);
    toast({ title: "Invitation created", description: "No email is sent in the prototype.", simulated: true });
  };

  return (
    <Modal open={open} onClose={close} title={link ? "Invitation ready" : "Invite an admin"} description={link ? undefined : "New admins join as staff with the permissions you choose."} size="md">
      {link ? (
        <div className="space-y-4">
          <Callout tone="success" title={`${name} was invited`}>
            Share this one-time link with them. They&apos;ll appear as “Invitation pending” until they sign in.
          </Callout>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-slate-50 p-2.5">
            <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(link).then(() => toast({ title: "Link copied", tone: "info" }))}>
              <Copy /> Copy
            </Button>
          </div>
          <SimulatedNote>Invitation links are simulated and don&apos;t work outside the prototype.</SimulatedNote>
          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" error={errors.name} required>
              {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="Work email" error={errors.email} required>
              {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@studyverse.example" />}
            </Field>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-fg">Permissions</p>
            <PermissionChecklist value={perms} onChange={setPerms} />
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">
              <Mail /> Create invitation
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function PermissionsDialog({ admin: target, onClose }: { admin: Admin | null; onClose: () => void }) {
  const { admin } = useSession();
  const [perms, setPerms] = useState<Permission[]>(target?.permissions ?? []);
  if (!target || !admin) return null;
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={`Permissions for ${target.name}`}
      description={target.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              updateAdminPermissions(target.id, perms, admin.id);
              toast({ title: "Permissions updated", simulated: true });
              onClose();
            }}
          >
            Save permissions
          </Button>
        </>
      }
    >
      <PermissionChecklist value={perms} onChange={setPerms} />
    </Modal>
  );
}

/* ------------------------------ Settings ------------------------------ */

export function SettingsPage() {
  const { state, admin } = useSession();
  if (!admin) return null;
  const owner = admin.role === "owner";
  const canPrice = hasPermission(admin, "pricing");
  const canTests = hasPermission(admin, "tests");

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Subscription pricing, payment instructions and platform configuration." />
      <PricingCard key={JSON.stringify(state.plans)} plans={state.plans} editable={canPrice} adminId={admin.id} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PaymentCard key={JSON.stringify(state.payment)} payment={state.payment} editable={owner} adminId={admin.id} />
        <div className="space-y-6">
          <PlatformCard key={JSON.stringify(state.platform)} platform={state.platform} editable={owner} adminId={admin.id} />
          <Card>
            <CardHeader title="Free demo test" description="Exactly one published test can be attempted without registration." />
            <div className="p-5">
              <Field label="Demo test" hint={canTests ? undefined : "Requires the Tests permission."}>
                {(p) => (
                  <Select
                    {...p}
                    disabled={!canTests}
                    value={state.tests.find((t) => t.isDemo)?.id ?? ""}
                    onChange={(e) => {
                      setDemoTest(e.target.value, admin.id);
                      toast({ title: "Demo test updated", simulated: true });
                    }}
                  >
                    {state.tests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                        {!t.published ? " (unpublished — will be published)" : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyNote({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Lock className="size-3.5" /> {text}
    </span>
  );
}

function PricingCard({ plans, editable, adminId }: { plans: Plan[]; editable: boolean; adminId: string }) {
  const [draft, setDraft] = useState(plans.map((p) => ({ ...p, priceText: String(p.price) })));
  const [error, setError] = useState<string | null>(null);
  const dirty = draft.some((d, i) => d.priceText !== String(plans[i].price) || d.enabled !== plans[i].enabled);

  const save = () => {
    if (draft.some((d) => !/^\d+$/.test(d.priceText) || Number(d.priceText) <= 0)) return setError("Prices must be whole rupee amounts above zero.");
    if (!draft.some((d) => d.enabled)) return setError("At least one duration must stay available.");
    setError(null);
    updatePlans(draft.map(({ priceText, ...p }) => ({ ...p, price: Number(priceText) })), adminId);
    toast({ title: "Pricing updated", description: "New prices apply to future requests.", simulated: true });
  };

  return (
    <Card>
      <CardHeader title="Subscription pricing" description="One all-access plan with three durations." action={!editable ? <ReadOnlyNote text="Requires pricing permission" /> : undefined} />
      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
        {draft.map((p, i) => (
          <div key={p.days} className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-fg">
                {p.days} days <span className="font-medium text-slate-500">· {p.label}</span>
              </p>
            </div>
            <Field label="Price (₹)" className="mt-3">
              {(f) => <Input {...f} inputMode="numeric" disabled={!editable} value={p.priceText} onChange={(e) => setDraft(draft.map((d, x) => (x === i ? { ...d, priceText: e.target.value.replace(/\D/g, "") } : d)))} />}
            </Field>
            <p className="mt-1.5 text-xs text-slate-500">≈ {formatINR(Math.round(Number(p.priceText || 0) / (p.days / 30)))} / month</p>
            <Switch className="mt-4" disabled={!editable} checked={p.enabled} onChange={(v) => setDraft(draft.map((d, x) => (x === i ? { ...d, enabled: v } : d)))} label="Available" />
          </div>
        ))}
      </div>
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          {error ? <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p> : <SimulatedNote>Existing subscriptions are not affected by price changes.</SimulatedNote>}
          <Button disabled={!dirty} onClick={save}>
            Save pricing
          </Button>
        </div>
      )}
    </Card>
  );
}

function PaymentCard({ payment, editable, adminId }: { payment: PaymentSettings; editable: boolean; adminId: string }) {
  const [d, setD] = useState({ ...payment, termsText: payment.terms.join("\n") });
  const dirty = JSON.stringify({ ...payment, termsText: payment.terms.join("\n") }) !== JSON.stringify(d);
  const fields: [keyof PaymentSettings, string][] = [
    ["upiId", "UPI ID"],
    ["payeeName", "UPI payee name"],
    ["bankName", "Bank name"],
    ["accountName", "Account name"],
    ["accountNumber", "Account number"],
    ["ifsc", "IFSC"],
  ];
  return (
    <Card>
      <CardHeader title="Payment instructions" description="Shown to learners on the Subscribe page." action={!editable ? <ReadOnlyNote text="Owner only" /> : undefined} />
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        {fields.map(([k, label]) => (
          <Field key={k} label={label}>
            {(p) => <Input {...p} disabled={!editable} value={d[k] as string} onChange={(e) => setD({ ...d, [k]: e.target.value })} className={k === "upiId" || k === "accountNumber" || k === "ifsc" ? "font-mono" : undefined} />}
          </Field>
        ))}
        <Field label="Terms (one per line)" className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={4} disabled={!editable} value={d.termsText} onChange={(e) => setD({ ...d, termsText: e.target.value })} />}
        </Field>
      </div>
      {editable && (
        <div className="flex justify-end border-t border-line px-5 py-3">
          <Button
            disabled={!dirty}
            onClick={() => {
              const { termsText, ...rest } = d;
              updatePaymentSettings({ ...rest, terms: termsText.split("\n").map((t) => t.trim()).filter(Boolean) }, adminId);
              toast({ title: "Payment instructions saved", simulated: true });
            }}
          >
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}

function PlatformCard({ platform, editable, adminId }: { platform: PlatformSettings; editable: boolean; adminId: string }) {
  const [d, setD] = useState(platform);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(platform);
  return (
    <Card>
      <CardHeader title="Platform settings" action={!editable ? <ReadOnlyNote text="Owner only" /> : undefined} />
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Support email" error={error}>
            {(p) => <Input {...p} type="email" disabled={!editable} value={d.supportEmail} onChange={(e) => setD({ ...d, supportEmail: e.target.value })} />}
          </Field>
          <Field label="Support phone">
            {(p) => <Input {...p} disabled={!editable} value={d.supportPhone} onChange={(e) => setD({ ...d, supportPhone: e.target.value })} />}
          </Field>
        </div>
        <Switch disabled={!editable} checked={d.allowSignups} onChange={(v) => setD({ ...d, allowSignups: v })} label="Allow new learner sign-ups" description="Display-only in the prototype." />
      </div>
      {editable && (
        <div className="flex justify-end border-t border-line px-5 py-3">
          <Button
            disabled={!dirty}
            onClick={() => {
              if (!isValidEmail(d.supportEmail)) return setError("Enter a valid email");
              setError(null);
              updatePlatformSettings(d, adminId);
              toast({ title: "Platform settings saved", simulated: true });
            }}
          >
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ Profile ------------------------------ */

export function AdminProfilePage() {
  const { admin } = useSession();
  if (!admin) return null;
  return <AdminProfileForm key={admin.id} admin={admin} />;
}

function AdminProfileForm({ admin }: { admin: Admin }) {
  const router = useRouter();
  const [name, setName] = useState(admin.name);
  const [email, setEmail] = useState(admin.email);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Account settings" description="Your admin profile and sign-in details." />
      <Card>
        <CardHeader title="Profile" />
        <form
          noValidate
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const errs: Record<string, string> = {};
            if (name.trim().length < 2) errs.name = "Enter your name";
            if (!isValidEmail(email)) errs.email = "Enter a valid email";
            setErrors(errs);
            if (Object.keys(errs).length) return;
            updateAdminProfile(admin.id, { name: name.trim(), email: email.trim() });
            toast({ title: "Profile updated", simulated: true });
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" error={errors.name}>
              {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="Email" error={errors.email}>
              {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={name === admin.name && email === admin.email}>
              Save profile
            </Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Role & permissions" />
        <div className="space-y-3 p-5">
          <p className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-brand-600 dark:text-brand-400" />
            <strong className="text-fg">{admin.role === "owner" ? "Owner" : "Staff admin"}</strong>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(admin.role === "owner" ? ALL_PERMS : admin.permissions).map((p) => (
              <Badge key={p} tone="slate">
                {PERMISSION_LABEL[p]}
              </Badge>
            ))}
            {admin.role === "owner" && <Badge tone="violet">Admins & platform settings</Badge>}
          </div>
          {admin.role !== "owner" && <p className="text-xs text-slate-500">Permissions are managed by the owner.</p>}
        </div>
      </Card>
      <Card>
        <CardHeader title="Session" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-slate-500">Two-factor authentication and real session management come with the production auth provider.</p>
          <Button variant="danger" onClick={() => setLogoutOpen(true)}>
            <LogOut /> Log out
          </Button>
        </div>
      </Card>
      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          logoutAdmin();
          router.push("/admin/login");
        }}
        title="Log out of the admin console?"
        confirmLabel="Log out"
        tone="danger"
      />
    </div>
  );
}
