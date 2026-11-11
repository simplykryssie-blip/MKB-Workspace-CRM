"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { call } from "@/lib/sync/remote";
import { US_STATES } from "@/lib/validation";
import { CLIENT_STATUSES, LEAD_STATUSES, OFFICE_STAGES, SERVICE_OPTIONS, type Brand, type Filters } from "@/lib/campaigns/config";

type Preview = { count: number; skipped: { noEmail: number; unsubscribed: number; duplicate: number; noPhone?: number; notSubscribed?: number }; sample: { name: string; type: string }[] };
const TYPE_LABEL: Record<string, string> = { lead: "Lead", client: "Client", office: "Firm", reseller: "Reseller" };

/** One line describing who's included. */
export function audienceSummary(brand: Brand, f: Filters) {
  const parts: string[] = [];
  if (brand === "mkb") {
    if (f.leads?.on) parts.push(`Leads${f.leads.statuses?.length ? ` (${f.leads.statuses.join(", ")})` : ""}${f.leads.services?.length ? ` interested in ${f.leads.services.join(", ")}` : ""}${f.leads.tags?.length ? ` tagged ${f.leads.tags.join(", ")}` : ""}`);
    if (f.clients?.on) parts.push(`Clients${f.clients.services?.length ? ` with ${f.clients.services.join(", ")}` : ""}${f.clients.statuses?.length ? ` (${f.clients.statuses.join(", ")})` : ""}`);
  } else {
    if (f.offices?.on) parts.push(`Firms${f.offices.stages?.length ? ` (${f.offices.stages.join(", ")})` : ""}`);
    if (f.resellers?.on) parts.push("Active resellers");
  }
  if (f.states?.length) parts.push(`in ${f.states.join(", ")}`);
  return parts.join(" + ") || "Nobody selected yet";
}

function Chips({ label, options, value, onChange }: { label: string; options: readonly (readonly [string, string])[]; value?: string[]; onChange: (v: string[]) => void }) {
  const v = value ?? [];
  return (
    <div>
      <p className="mb-1 text-[12.5px] font-medium text-ink-2">{label} <span className="font-normal text-muted">{v.length ? "" : "— any"}</span></p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([k, l]) => { const on = v.includes(k); return <button key={k} type="button" aria-pressed={on} onClick={() => onChange(on ? v.filter((x) => x !== k) : [...v, k])} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-hover"}`}>{l}</button>; })}
      </div>
    </div>
  );
}

function Group({ title, on, onToggle, children }: { title: string; on: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3.5 ${on ? "border-accent/50 bg-accent-soft/30" : "border-line"}`}>
      <label className="flex items-center gap-2 text-[14px] font-semibold text-ink"><input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />{title}</label>
      {on && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

/** Pick who gets a campaign, with a live count of who's included and who's skipped. */
export function AudienceBuilder({ brand, filters: f, onChange, disabled, channel = "email" }: { brand: Brand; filters: Filters; onChange: (f: Filters) => void; disabled?: boolean; channel?: "email" | "sms" }) {
  const [opts, setOpts] = useState<{ stages: { id: string; name: string }[]; tags: string[] }>({ stages: [], tags: [] });
  const [pv, setPv] = useState<Preview | null>(null);
  useEffect(() => { call<typeof opts>("GET", "/api/campaigns/audience").then(setOpts).catch(() => {}); }, []);
  const key = JSON.stringify(f);
  useEffect(() => {
    setPv(null);
    const t = setTimeout(() => { call<Preview>("POST", "/api/campaigns/audience", { brand, channel, filters: JSON.parse(key) }).then(setPv).catch(() => {}); }, 350);
    return () => clearTimeout(t);
  }, [brand, key, channel]);
  const states = US_STATES.map(([code]) => [code, code] as const);

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      {brand === "mkb" ? (
        <>
          <Group title="Leads" on={!!f.leads?.on} onToggle={(on) => onChange({ ...f, leads: { ...f.leads, on } })}>
            <Chips label="Lead status" options={LEAD_STATUSES} value={f.leads?.statuses} onChange={(statuses) => onChange({ ...f, leads: { on: true, ...f.leads, statuses } })} />
            {opts.stages.length > 0 && <Chips label="Pipeline stage" options={opts.stages.map((s) => [s.id, s.name] as const)} value={f.leads?.stages} onChange={(stages) => onChange({ ...f, leads: { on: true, ...f.leads, stages } })} />}
            <Chips label="Interested in" options={SERVICE_OPTIONS} value={f.leads?.services} onChange={(services) => onChange({ ...f, leads: { on: true, ...f.leads, services } })} />
            {opts.tags.length > 0 && <Chips label="Tagged" options={opts.tags.map((t) => [t, t] as const)} value={f.leads?.tags} onChange={(tags) => onChange({ ...f, leads: { on: true, ...f.leads, tags } })} />}
          </Group>
          <Group title="Clients" on={!!f.clients?.on} onToggle={(on) => onChange({ ...f, clients: { ...f.clients, on } })}>
            <Chips label="Client status" options={CLIENT_STATUSES} value={f.clients?.statuses} onChange={(statuses) => onChange({ ...f, clients: { on: true, ...f.clients, statuses } })} />
            <Chips label="Uses" options={SERVICE_OPTIONS} value={f.clients?.services} onChange={(services) => onChange({ ...f, clients: { on: true, ...f.clients, services } })} />
          </Group>
        </>
      ) : (
        <>
          <Group title="Firms (sign-ups, form contacts and software customers)" on={!!f.offices?.on} onToggle={(on) => onChange({ ...f, offices: { ...f.offices, on } })}>
            <Chips label="Stage" options={OFFICE_STAGES} value={f.offices?.stages} onChange={(stages) => onChange({ ...f, offices: { on: true, ...f.offices, stages } })} />
          </Group>
          <Group title="Resellers" on={!!f.resellers?.on} onToggle={(on) => onChange({ ...f, resellers: { on } })}><p className="text-[12.5px] text-muted">Active resellers.</p></Group>
        </>
      )}
      <details className="rounded-xl border border-line p-3.5">
        <summary className="cursor-pointer text-[13.5px] font-medium text-ink-2">Only certain states {f.states?.length ? `(${f.states.join(", ")})` : "— any"}</summary>
        <div className="mt-3"><Chips label="States" options={states} value={f.states} onChange={(s) => onChange({ ...f, states: s })} /></div>
      </details>
      <div className="flex items-start gap-3 rounded-xl bg-surface-2 p-3.5" aria-live="polite">
        <Users size={18} className="mt-0.5 shrink-0 text-accent" />
        {pv ? (
          <div className="text-[13px] text-ink-2">
            <p className="text-[15px] font-semibold text-ink">{pv.count} {pv.count === 1 ? "person" : "people"} will get this {channel === "sms" ? "text" : "email"}</p>
            {channel === "sms"
              ? <p className="text-muted">Skipped: {pv.skipped.notSubscribed ?? 0} haven&rsquo;t opted in to texts · {pv.skipped.unsubscribed} replied STOP · {pv.skipped.noPhone ?? 0} without a mobile number · {pv.skipped.duplicate} duplicates</p>
              : <p className="text-muted">Skipped: {pv.skipped.unsubscribed} unsubscribed · {pv.skipped.noEmail} without an email · {pv.skipped.duplicate} duplicates (same email counted once)</p>}
            {pv.sample.length > 0 && <p className="mt-1 truncate">e.g. {pv.sample.map((s) => `${s.name} (${TYPE_LABEL[s.type] ?? s.type})`).join(", ")}</p>}
          </div>
        ) : <p className="text-[13px] text-muted">Counting…</p>}
      </div>
    </fieldset>
  );
}
