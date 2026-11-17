"use client";

import { useEffect, useState } from "react";
import { BarChart3, ExternalLink, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { publicOrigin } from "@/lib/forms/config";

type Funnels = {
  settings: { moneyVault: { on: boolean; formId?: string; turnedOnAt?: string }; tracking: { metaPixelId: string; gaId: string } };
  form: { id: string; slug: string; status: string } | null;
  campaignId: string; taxYear: number; path: string;
};
type Report = {
  on: boolean; visits: number; inquiries: number; newLeads: number; qualified: number; lost: number; clients: number;
  interviewsSubmitted: number; returnsFiled: number; paidInvoices: number; revenueCents: number;
  byStage: { name: string; count: number }[]; sources: { name: string; count: number }[];
};
const input = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink disabled:opacity-60";
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

/** Settings → Campaigns: the Money Vault page switch, tracking IDs and the campaign report. */
export function FunnelsCard() {
  const team = useTeam();
  const toast = useToast();
  const canView = team.can("settings", "view");
  const canEdit = team.can("settings", "settings");
  const canReport = team.can("leads", "view");
  const [v, setV] = useState<Funnels | null>(null);
  const [rep, setRep] = useState<Report | null>(null);
  const [pixel, setPixel] = useState("");
  const [ga, setGa] = useState("");
  const [busy, setBusy] = useState(false);
  const loadReport = () => { if (canReport) call<Report>("GET", "/api/funnels/money-vault/report").then(setRep).catch(() => {}); };
  useEffect(() => {
    if (!BACKEND || !canView) return;
    call<Funnels>("GET", "/api/settings/funnels").then((r) => { setV(r); setPixel(r.settings.tracking.metaPixelId); setGa(r.settings.tracking.gaId); }).catch(() => {});
    loadReport();
  }, [canView]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!BACKEND) return <Card className="p-6 text-[14px] text-muted">Campaign funnels need the live CRM (preview or production).</Card>;
  if (!canView || !v) return null;
  const on = v.settings.moneyVault.on;
  // The live website serves it at /unlock; preview and local copies show website pages under /site.
  const o = publicOrigin();
  const url = o === "https://www.mkbfinancialgroup.com" ? `${o}${v.path}` : `${o}/site${v.path}`;
  const save = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true);
    try { const r = await call<Funnels>("PUT", "/api/settings/funnels", body); setV(r); setPixel(r.settings.tracking.metaPixelId); setGa(r.settings.tracking.gaId); toast(msg); loadReport(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  const trackingDirty = pixel.trim() !== v.settings.tracking.metaPixelId || ga.trim().toUpperCase() !== v.settings.tracking.gaId;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={Megaphone} title="2027 Money Vault page" subtitle={`Tax campaign for tax year ${v.taxYear} at ${v.path}. When it's off, ${v.path} sends visitors to your Tax Preparation page.`} action={<Badge tone={on ? "success" : "neutral"}>{on ? "On" : "Off"}</Badge>} />
        <div className="space-y-4 px-5 pb-5 text-[13.5px] text-ink-2 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant={on ? "secondary" : "primary"} disabled={!canEdit || busy} onClick={() => { if (!on || window.confirm("Turn the Money Vault page off? Visitors will be sent to your Tax Preparation page.")) void save({ moneyVaultOn: !on }, on ? "Money Vault page turned off" : "Money Vault page is on"); }}>{on ? "Turn off" : "Turn on"}</Button>
            {on && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all font-semibold text-accent hover:underline">{url} <ExternalLink size={14} /></a>}
          </div>
          <p>Inquiries become leads in your pipeline (stage <b>New</b>), tagged <b>Money Vault 2027</b> and <b>Tax year {v.taxYear}</b>. Each one gets the {v.taxYear} tax interview link by email, with a <b>Book a call</b> button for a tax appointment.</p>
          {v.form ? <p>The questions are the <a href="/forms" className="font-semibold text-accent hover:underline">“2027 Money Vault inquiry” form</a> — edit them in Forms.{v.form.status !== "published" && <span className="text-warning-ink"> That form isn&rsquo;t published, so the page stays off until it is.</span>}</p> : <p>Turning it on the first time creates the inquiry form for you (you can edit it in Forms).</p>}
        </div>
      </Card>

      <Card>
        <CardHeader icon={BarChart3} title="Ad tracking" subtitle="Used only on the Money Vault page. They receive page views and form progress (step numbers, “lead”), never names, emails, phone numbers or answers." />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6">
          <label><span className="mb-1 block text-[13px] font-medium text-ink">Meta Pixel ID</span><input className={input} inputMode="numeric" value={pixel} onChange={(e) => setPixel(e.target.value)} placeholder="e.g. 123456789012345" disabled={!canEdit} /></label>
          <label><span className="mb-1 block text-[13px] font-medium text-ink">Google Analytics measurement ID</span><input className={input} value={ga} onChange={(e) => setGa(e.target.value)} placeholder="e.g. G-AB12CD34EF" disabled={!canEdit} /></label>
          <div className="sm:col-span-2"><Button variant="primary" disabled={!canEdit || busy || !trackingDirty} onClick={() => void save({ metaPixelId: pixel, gaId: ga }, "Tracking IDs saved")}>Save tracking IDs</Button></div>
        </div>
      </Card>

      {canReport && rep && (
        <Card>
          <CardHeader icon={BarChart3} title="Campaign report" subtitle="Counts only. Staff tests and spam aren't counted. Visits are counted once per browser session." />
          <div className="px-5 pb-5 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                ["Page visits", rep.visits, ""],
                ["Inquiries", rep.inquiries, rep.visits ? pct(rep.inquiries, rep.visits) + " of visits" : ""],
                ["Qualified", rep.qualified, rep.inquiries ? pct(rep.qualified, rep.inquiries) + " of inquiries" : ""],
                ["Became clients", rep.clients, rep.inquiries ? pct(rep.clients, rep.inquiries) + " of inquiries" : ""],
                ["Interviews submitted", rep.interviewsSubmitted, ""],
                ["Returns filed", rep.returnsFiled, ""],
                ["Paid invoices", rep.paidInvoices, ""],
                ["Revenue collected", `$${(rep.revenueCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, ""],
              ] as const).map(([l, n, sub]) => (
                <div key={l} className="rounded-2xl bg-surface-2 px-4 py-3 ring-1 ring-line">
                  <p className="text-[12px] font-semibold text-muted">{l}</p>
                  <p className="mt-0.5 text-[22px] font-bold tabular-nums text-ink">{n}</p>
                  {sub && <p className="text-[11.5px] text-muted">{sub}</p>}
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-[13px] font-semibold text-ink">Open leads by stage</p>
                <ul className="mt-2 space-y-1 text-[13.5px]">{rep.byStage.map((s) => <li key={s.name} className="flex justify-between border-b border-line/60 py-1"><span>{s.name}</span><span className="tabular-nums">{s.count}</span></li>)}<li className="flex justify-between py-1 text-muted"><span>Lost</span><span className="tabular-nums">{rep.lost}</span></li></ul>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink">Where inquiries came from (first visit)</p>
                {rep.sources.length ? <ul className="mt-2 space-y-1 text-[13.5px]">{rep.sources.map((s) => <li key={s.name} className="flex justify-between border-b border-line/60 py-1"><span className="truncate pr-3">{s.name}</span><span className="tabular-nums">{s.count}</span></li>)}</ul> : <p className="mt-2 text-[13px] text-muted">No inquiries yet.</p>}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
