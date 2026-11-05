"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClients } from "@/lib/store/clients-store";
import { useToast } from "@/components/ui/Toast";
import { AlertTriangle, ArrowRight, Building2, User } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ServiceTag } from "@/components/ui/ServiceTag";
import { SERVICES, SERVICE_ORDER } from "@/lib/sample-data";
import { STAFF } from "@/lib/sample/clients";
import type { ServiceKey } from "@/lib/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function NewClientForm() {
  const router = useRouter();
  const store = useClients();
  const toast = useToast();
  const CLIENTS = store.clients;
  const [type, setType] = useState<"individual" | "business">("individual");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [services, setServices] = useState<ServiceKey[]>([]);
  const [staff, setStaff] = useState<string[]>([]);
  const [invite, setInvite] = useState(true);

  // Duplicate detection: same email, same phone digits, or same normalized name.
  const dupes = useMemo(() => {
    const e = email.trim().toLowerCase();
    const p = phone.replace(/\D/g, "");
    const n = norm(name);
    return CLIENTS.filter(
      (c) =>
        (e.length > 4 && c.email.toLowerCase() === e) ||
        (p.length >= 7 && c.phone.replace(/\D/g, "").endsWith(p.slice(-7))) ||
        (n.length >= 4 && norm(c.name).includes(n)),
    ).slice(0, 3);
  }, [CLIENTS, email, phone, name]);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const valid = name.trim() && email.includes("@") && services.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const id = store.addClient({ type, name, contactName: contact, email, phone, services, staffIds: staff, invite });
        toast(`${name.trim()} created${invite ? " — portal invitation sent" : ""}`);
        router.push(`/clients/${id}`);
      }}
      className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
    >
      <div className="space-y-5">
        <Card>
          <CardHeader title="Client details" />
          <div className="space-y-4 px-5 pb-5 sm:px-6">
            <div role="radiogroup" aria-label="Client type" className="grid grid-cols-2 gap-2">
              {(
                [
                  ["individual", "Individual", User],
                  ["business", "Business", Building2],
                ] as const
              ).map(([v, l, Icon]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={type === v}
                  onClick={() => setType(v)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-[14px] font-medium ${type === v ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}
                >
                  <Icon size={18} /> {l}
                </button>
              ))}
            </div>
            <Field label={type === "business" ? "Business name" : "Full name"} required value={name} onChange={setName} placeholder={type === "business" ? "e.g. Sample Ventures LLC" : "e.g. Alex Example"} />
            {type === "business" && <Field label="Primary contact" value={contact} onChange={setContact} placeholder="Contact person's name" />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" type="email" required value={email} onChange={setEmail} placeholder="name@example.com" />
              <Field label="Phone" type="tel" value={phone} onChange={setPhone} placeholder="(555) 010-0000" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Services" subtitle="Pick one or more — they all attach to this single client record" />
          <div className="grid gap-2 px-5 pb-5 sm:grid-cols-2 sm:px-6">
            {SERVICE_ORDER.map((s) => {
              const on = services.includes(s);
              return (
                <label key={s} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${on ? "border-accent bg-accent-soft/60" : "border-line hover:bg-surface-hover"}`}>
                  <input type="checkbox" checked={on} onChange={() => setServices((x) => toggle(x, s))} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="h-6 w-1.5 rounded-full" style={{ background: `var(--svc-${s})` }} />
                  <span className="text-[14px] font-medium text-ink">{SERVICES[s].label}</span>
                </label>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        {dupes.length > 0 && (
          <div role="alert" className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-warning-ink">
              <AlertTriangle size={17} /> Possible existing client
            </div>
            <p className="mt-1 text-[13px] text-ink-2">To avoid a duplicate record, add a new service to the existing client instead.</p>
            <ul className="mt-3 space-y-2">
              {dupes.map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}#services`} className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5 hover:border-accent">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{c.name}</span>
                      <span className="block truncate text-[12px] text-muted">{c.email}</span>
                    </span>
                    <span className="flex gap-1">
                      {[...new Set(c.enrollments.map((e) => e.service))].map((s) => (
                        <ServiceTag key={s} service={s} short />
                      ))}
                    </span>
                    <ArrowRight size={15} className="text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Card>
          <CardHeader title="Assignment & access" />
          <div className="space-y-4 px-5 pb-5 sm:px-6">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-2">Assigned staff</legend>
              <div className="flex flex-wrap gap-2">
                {STAFF.map((s) => {
                  const on = staff.includes(s.id);
                  return (
                    <button key={s.id} type="button" aria-pressed={on} onClick={() => setStaff((x) => toggle(x, s.id))} className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="flex items-start gap-3 rounded-xl border border-line p-3">
              <input type="checkbox" checked={invite} onChange={() => setInvite((v) => !v)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span>
                <span className="block text-[14px] font-medium text-ink">Send client portal invitation</span>
                <span className="block text-[12.5px] text-muted">Client sets their own password and multi-factor authentication.</span>
              </span>
            </label>
            <Button variant="primary" className="w-full" disabled={!valid} type="submit">
              Create client
            </Button>
            {!valid && <p className="text-center text-[12px] text-muted">Name, email and at least one service are required.</p>}
          </div>
        </Card>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, required, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
      />
    </label>
  );
}
