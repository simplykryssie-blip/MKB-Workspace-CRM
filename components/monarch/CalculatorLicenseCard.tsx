"use client";

import { useEffect, useState } from "react";
import { Calculator, Copy, Mail, Plus, Save, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";

type Leads = { enabled: boolean; businessName: string; leadSource: string; includeSummary: boolean; tags: string[]; webhookHost: string; webhookSaved: boolean; lastSuccessAt: string | null; lastError: string | null; lastErrorAt: string | null };
type License = { id: string; maxDomains: number; embedId: string; keyPrefix: string; taxYears: number[]; status: "active" | "suspended" | "revoked"; source: string; lastSeenAt: string | null; lastSeenHost: string | null; createdAt: string; domains: string[]; installUrl: string; snippet: string; leads: Leads; last30: Record<string, number> };
const input = "h-9 w-full rounded-xl border border-line bg-surface px-3 text-[13.5px] text-ink disabled:opacity-60";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "never");

/** Monarch office: its tax calculator license — status, websites it may appear on, install code, and lead delivery. */
export function CalculatorLicenseCard({ officeId }: { officeId: string }) {
  const toast = useToast();
  const team = useTeam();
  const canEdit = team.can("monarch", "edit");
  const [list, setList] = useState<License[] | null>(null);
  const [busy, setBusy] = useState(false);
  const path = `/api/monarch/offices/${officeId}/calculator`;
  useEffect(() => { if (BACKEND) call<{ licenses: License[] }>("GET", path).then((r) => setList((cur) => cur ?? r.licenses)).catch(() => setList([])); }, [path]);
  if (!BACKEND || !list) return null;
  const act = async (b: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { setList((await call<{ licenses: License[] }>("POST", path, b)).licenses); toast(ok); return true; } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); return false; } finally { setBusy(false); }
  };
  return (
    <Card className="px-5 py-4 sm:px-6">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Calculator size={15} /> Tax calculator license</p>
      {!list.length && (
        <div className="mt-2 space-y-2 text-[13px] text-muted">
          <p>No calculator license yet.</p>
          {canEdit && <Button size="sm" icon={Plus} disabled={busy} onClick={() => void act({ action: "create" }, "License created")}>Create a license</Button>}
        </div>
      )}
      {list.map((l) => <LicenseBlock key={l.id} l={l} canEdit={canEdit} busy={busy} act={act} />)}
    </Card>
  );
}

function LicenseBlock({ l, canEdit, busy, act }: { l: License; canEdit: boolean; busy: boolean; act: (b: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const toast = useToast();
  const [domain, setDomain] = useState("");
  const [f, setF] = useState({ enabled: l.leads.enabled, businessName: l.leads.businessName, leadSource: l.leads.leadSource, includeSummary: l.leads.includeSummary, webhookUrl: "" });
  useEffect(() => { setF((x) => ({ ...x, enabled: l.leads.enabled, businessName: l.leads.businessName, leadSource: l.leads.leadSource, includeSummary: l.leads.includeSummary, webhookUrl: "" })); }, [l.leads.enabled, l.leads.businessName, l.leads.leadSource, l.leads.includeSummary, l.leads.webhookHost]);
  const copy = (t: string, what: string) => { void navigator.clipboard?.writeText(t).then(() => toast(`${what} copied`)).catch(() => toast("Couldn't copy", "info")); };
  const sent = l.last30.sent ?? 0, failed = l.last30.failed ?? 0;
  return (
    <div className="mt-3 space-y-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={l.status === "active" ? "success" : "warning"}>{l.status === "active" ? "Active" : l.status === "suspended" ? "Suspended" : "Revoked"}</Badge>
        <span className="text-muted">{l.taxYears.join(", ")} tax year{l.taxYears.length === 1 ? "" : "s"}{l.keyPrefix ? ` · key ${l.keyPrefix}…` : ""}{l.source === "verexa" ? " · moved from Verexa" : ""}</span>
      </div>
      <p className="text-[12.5px] text-muted">Last shown on a website: {l.lastSeenAt ? `${when(l.lastSeenAt)} (${l.lastSeenHost})` : "not yet"}</p>

      <div>
        <p className="mb-1 font-medium text-ink">Websites it can appear on</p>
        <div className="flex flex-wrap gap-1.5">
          {l.domains.map((d) => <span key={d} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12.5px] text-ink">{d}{canEdit && <button type="button" aria-label={`Remove ${d}`} disabled={busy} onClick={() => { if (confirm(`Remove ${d}? The calculator stops showing there.`)) void act({ action: "removeDomain", licenseId: l.id, domain: d }, "Website removed"); }}><Trash2 className="h-3.5 w-3.5 text-muted" /></button>}</span>)}
          {!l.domains.length && <span className="text-muted">None yet — the calculator won't show anywhere.</span>}
        </div>
        {canEdit && <div className="mt-2 flex gap-2"><input aria-label="Website to authorize" value={domain} placeholder="e.g. securefiletaxes.net" onChange={(e) => setDomain(e.target.value)} className={input} /><Button size="sm" icon={Plus} disabled={busy || !domain.trim()} onClick={() => void act({ action: "addDomain", licenseId: l.id, domain }, "Website added").then((ok) => ok && setDomain(""))}>Add</Button></div>}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" icon={Mail} disabled={busy} onClick={() => { if (confirm("Email the customer a new private setup link? Any older link stops working.")) void act({ action: "emailSetup", licenseId: l.id }, "Setup link emailed"); }}>Email setup link</Button>
          <label className="flex items-center gap-1.5 text-[12.5px] text-muted">Websites they can add
            <input type="number" min={1} max={50} defaultValue={l.maxDomains} key={l.maxDomains} aria-label="Websites the customer can add" onBlur={(e) => Number(e.target.value) !== l.maxDomains && void act({ action: "maxDomains", licenseId: l.id, maxDomains: Number(e.target.value) }, "Website limit saved")} className="h-8 w-16 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink" />
          </label>
        </div>
      )}

      <div>
        <p className="mb-1 font-medium text-ink">Install code</p>
        <p className="break-all rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[11.5px] text-ink-2">{l.installUrl}</p>
        <div className="mt-1.5 flex flex-wrap gap-2"><Button size="sm" icon={Copy} onClick={() => copy(l.installUrl, "Calculator address")}>Copy address</Button><Button size="sm" icon={Copy} onClick={() => copy(l.snippet, "Embed code")}>Copy embed code</Button></div>
      </div>

      <div className="rounded-xl border border-line p-3">
        <p className="font-medium text-ink">Leads to their GoHighLevel</p>
        <p className="text-[12px] text-muted">{l.leads.webhookSaved ? `Webhook saved (${l.leads.webhookHost}).` : "No webhook saved yet."} Last delivered: {when(l.leads.lastSuccessAt)}. Last 30 days: {sent} sent{failed ? `, ${failed} failed` : ""}.</p>
        {l.leads.lastError && <p className="mt-1 text-[12px] text-warning-ink">{l.leads.lastError} ({when(l.leads.lastErrorAt)})</p>}
        <div className="mt-2 grid gap-2">
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Show the lead form on the calculator</label>
          <div><label className="mb-0.5 block text-[12px] text-muted" htmlFor={`bn-${l.id}`}>Business name shown to visitors</label><input id={`bn-${l.id}`} disabled={!canEdit} value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} className={input} /></div>
          <div><label className="mb-0.5 block text-[12px] text-muted" htmlFor={`ls-${l.id}`}>Lead source (in their CRM)</label><input id={`ls-${l.id}`} disabled={!canEdit} value={f.leadSource} onChange={(e) => setF({ ...f, leadSource: e.target.value })} className={input} /></div>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={f.includeSummary} onChange={(e) => setF({ ...f, includeSummary: e.target.checked })} /> Send the estimate with the lead</label>
          <div><label className="mb-0.5 block text-[12px] text-muted" htmlFor={`wh-${l.id}`}>GoHighLevel inbound webhook URL{l.leads.webhookSaved ? " (paste only to replace the saved one)" : ""}</label><input id={`wh-${l.id}`} type="password" autoComplete="off" disabled={!canEdit} value={f.webhookUrl} placeholder={l.leads.webhookSaved ? "•••• saved" : "https://services.leadconnectorhq.com/hooks/…"} onChange={(e) => setF({ ...f, webhookUrl: e.target.value })} className={input} /></div>
        </div>
        {canEdit && <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="primary" icon={Save} disabled={busy} onClick={() => void act({ action: "leads", licenseId: l.id, ...f }, "Lead delivery saved")}>Save</Button><Button size="sm" icon={Send} disabled={busy || !l.leads.webhookSaved} onClick={() => void act({ action: "testLead", licenseId: l.id }, "Test lead sent — check their GoHighLevel")}>Send a test lead</Button></div>}
      </div>

      {canEdit && <div className="flex flex-wrap gap-2 border-t border-line pt-3">{l.status === "active" ? <Button size="sm" disabled={busy} onClick={() => { if (confirm("Suspend this license? The calculator stops showing on their website right away.")) void act({ action: "status", licenseId: l.id, status: "suspended" }, "License suspended"); }}>Suspend license</Button> : <Button size="sm" disabled={busy} onClick={() => void act({ action: "status", licenseId: l.id, status: "active" }, "License turned back on")}>Turn back on</Button>}</div>}
    </div>
  );
}
