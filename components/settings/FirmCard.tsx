"use client";

import { useEffect, useState } from "react";
import { Building2, CalendarOff, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";

type Firm = { legalName: string; structure: string; address: string; city: string; state: string; zip: string; phone: string; email: string; einLast4: string; efinLast4: string; efinStatus: string; efinVerifiedFrom: string; efinRenewBy: string; ero: string };
type Closure = { id: string; name: string; start: string; end: string; source: string };
type Data = { firm: Firm; closures: Closure[] };
const input = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink disabled:opacity-60";
const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** The firm's own record (address, EIN/EFIN last 4, EFIN renewal, ERO) and office closed days. */
export function FirmCard() {
  const team = useTeam();
  const toast = useToast();
  const canEdit = team.can("settings", "settings");
  const [d, setD] = useState<Data | null>(null);
  const [f, setF] = useState<Firm | null>(null);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState({ name: "", start: "", end: "" });
  const [showPast, setShowPast] = useState(false);
  useEffect(() => { if (BACKEND) call<Data>("GET", "/api/settings/firm").then((r) => { setD((cur) => cur ?? r); setF((cur) => cur ?? r.firm); }).catch((e) => toast(e instanceof Error ? e.message : "Couldn't load", "info")); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // (Only the first answer fills the form, so a slow second load never wipes what's been typed.)
  if (!BACKEND) return null;
  if (!d || !f) return <Card className="p-8 text-center text-muted">Loading…</Card>;
  const act = async (fn: () => Promise<Data>, ok: string) => {
    setBusy(true);
    try { const r = await fn(); setD(r); setF(r.firm); toast(ok); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  const F = (k: keyof Firm, label: string, hint?: string, className = "", type = "text") => (
    <div className={className}><label htmlFor={`fm-${k}`} className="mb-1 block text-[13px] font-medium text-ink-2">{label}{hint && <span className="font-normal text-muted"> {hint}</span>}</label><input id={`fm-${k}`} type={type} disabled={!canEdit} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={input} /></div>
  );
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = d.closures.filter((c) => c.end >= today);
  const past = d.closures.filter((c) => c.end < today);
  const renewSoon = f.efinRenewBy && new Date(f.efinRenewBy).getTime() - Date.now() < 90 * 864e5;
  return (
    <>
      <Card>
        <CardHeader icon={Building2} title="Your firm" subtitle="MKB's own record. Staff only — never shown to clients. Only the last 4 digits of the EIN and EFIN are kept here." action={f.efinRenewBy ? <Badge tone={renewSoon ? "warning" : "success"}>EFIN check by {nice(f.efinRenewBy).replace(/^\w+, /, "")}</Badge> : undefined} />
        <div className="space-y-4 px-5 pb-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {F("legalName", "Legal name")}
            {F("structure", "Business structure", "(e.g. Sole proprietorship)")}
            {F("address", "Office address", undefined, "sm:col-span-2")}
            {F("city", "City")}
            <div className="grid grid-cols-2 gap-4">{F("state", "State")}{F("zip", "ZIP")}</div>
            {F("phone", "Phone")}
            {F("email", "Email")}
            {F("einLast4", "EIN", "(last 4)")}
            {F("efinLast4", "EFIN", "(last 4)")}
            {F("efinStatus", "EFIN status")}
            {F("efinVerifiedFrom", "EFIN verified from")}
            {F("efinRenewBy", "EFIN check / renewal date", undefined, "", "date")}
            {F("ero", "ERO (responsible official)")}
          </div>
          {canEdit && <Button variant="primary" icon={Save} disabled={busy || JSON.stringify(f) === JSON.stringify(d.firm)} onClick={() => void act(() => call<Data>("PUT", "/api/settings/firm", { firm: f }), "Firm details saved")}>Save</Button>}
        </div>
      </Card>
      <Card>
        <CardHeader icon={CalendarOff} title="Office closed days" subtitle="Holidays and other days the office is closed. Online booking skips these days for everyone." action={<Badge tone="neutral">{upcoming.length} coming up</Badge>} />
        <div className="space-y-3 px-5 pb-5 text-[13.5px] sm:px-6">
          {upcoming.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {upcoming.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1"><span className="block font-medium text-ink">{c.name}</span><span className="block text-[12.5px] text-muted">{nice(c.start)}{c.end !== c.start ? ` – ${nice(c.end)}` : ""}</span></span>
                  {canEdit && <button type="button" aria-label={`Remove ${c.name} ${c.start}`} disabled={busy} onClick={() => void act(() => call<Data>("DELETE", `/api/settings/closures/${c.id}`), "Closed day removed")} className="rounded-lg p-2 text-muted hover:bg-surface-2"><Trash2 size={15} /></button>}
                </li>
              ))}
            </ul>
          ) : <p className="text-muted">No closed days coming up.</p>}
          {past.length > 0 && <button type="button" className="text-[12.5px] font-medium text-accent" onClick={() => setShowPast(!showPast)}>{showPast ? "Hide" : "Show"} {past.length} past closed day{past.length === 1 ? "" : "s"}</button>}
          {showPast && <ul className="text-[12.5px] text-muted">{past.map((c) => <li key={c.id}>{c.name} · {nice(c.start)}{c.end !== c.start ? ` – ${nice(c.end)}` : ""}</li>)}</ul>}
          {canEdit && (
            <div className="grid gap-2 rounded-xl bg-surface-2/60 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
              <div><label htmlFor="cl-name" className="mb-1 block text-[12.5px] font-medium text-ink-2">Add a closed day</label><input id="cl-name" value={add.name} placeholder="e.g. Office retreat" onChange={(e) => setAdd({ ...add, name: e.target.value })} className={input} /></div>
              <div><label htmlFor="cl-start" className="mb-1 block text-[12.5px] font-medium text-ink-2">From</label><input id="cl-start" type="date" value={add.start} onChange={(e) => setAdd({ ...add, start: e.target.value })} className={input} /></div>
              <div><label htmlFor="cl-end" className="mb-1 block text-[12.5px] font-medium text-ink-2">To <span className="font-normal text-muted">(optional)</span></label><input id="cl-end" type="date" value={add.end} onChange={(e) => setAdd({ ...add, end: e.target.value })} className={input} /></div>
              <Button icon={Plus} disabled={busy || !add.name.trim() || !add.start} onClick={() => void act(async () => { const r = await call<Data>("POST", "/api/settings/closures", add); setAdd({ name: "", start: "", end: "" }); return r; }, "Closed day added")}>Add</Button>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
