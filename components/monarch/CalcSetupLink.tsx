"use client";

/* eslint-disable @next/next/no-img-element -- static brand image */
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Globe, Plus, Send, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PLATFORM_GUIDES } from "@/lib/calculator/platforms";

/**
 * A calculator buyer's private setup page (no login): add their websites, copy the install code with
 * step-by-step instructions, and connect their GoHighLevel so leads go straight to them.
 */
type View = {
  office: { name: string; contactName: string };
  license: { status: string; taxYears: number[]; maxDomains: number; lastSeenAt: string | null; lastSeenHost: string | null };
  domains: string[]; installUrl: string; snippet: string;
  leads: { enabled: boolean; businessName: string; webhookHost: string; webhookSaved: boolean; lastSuccessAt: string | null; lastError: string | null };
  contact: { phone: string; email: string };
};
class LinkError extends Error { constructor(public status: number, message: string) { super(message); } }
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const input = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink";

export function CalcSetupLink({ token }: { token: string }) {
  const base = `/api/public/monarch/calc/${encodeURIComponent(token)}`;
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<LinkError | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [domain, setDomain] = useState("");
  const [platform, setPlatform] = useState(PLATFORM_GUIDES[0].id);
  const [f, setF] = useState({ enabled: false, businessName: "", webhookUrl: "" });
  useEffect(() => {
    fetch(base, { cache: "no-store" }).then(async (r) => {
      const d = (await r.json().catch(() => ({}))) as View & { error?: string };
      if (!r.ok) throw new LinkError(r.status, d.error ?? "This link isn't valid.");
      setV(d); setF({ enabled: d.leads.enabled, businessName: d.leads.businessName, webhookUrl: "" });
    }).catch((e) => setErr(e instanceof LinkError ? e : new LinkError(0, "We couldn't load your setup page. Check your connection and try again.")));
  }, [base]);
  const act = async (b: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
      const d = (await r.json().catch(() => ({}))) as View & { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Something went wrong.");
      setV(d); setF((x) => ({ ...x, enabled: d.leads.enabled, businessName: d.leads.businessName, webhookUrl: "" })); setMsg({ ok: true, text: ok }); return true;
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." }); return false; } finally { setBusy(false); }
  };
  const copy = (t: string, what: string) => { void navigator.clipboard?.writeText(t).then(() => setMsg({ ok: true, text: `${what} copied` })).catch(() => setMsg({ ok: false, text: "Couldn't copy. Press and hold to copy instead." })); };
  const guide = PLATFORM_GUIDES.find((g) => g.id === platform) ?? PLATFORM_GUIDES[0];
  const active = v?.license.status === "active";
  return (
    <main className="min-h-screen bg-bg pb-12">
      <header className="bg-[#0b0b0b] px-4 pb-5 pt-4 text-white">
        <div className="mx-auto max-w-2xl">
          <img src="/brand/monarch-logo-dark.webp" alt="Monarch Tax Suite" width={190} height={43} className="h-auto" style={{ width: 190 }} />
          {v && <>
            <h1 className="mt-4 text-[22px] font-bold leading-tight">Your tax calculator</h1>
            <p className="mt-1 text-[14px] text-white/75">{v.office.name} · Monarch Basic Tax Calculator · {v.license.taxYears.join(", ")} tax year{v.license.taxYears.length === 1 ? "" : "s"}</p>
          </>}
        </div>
      </header>
      <div className="h-1 bg-[linear-gradient(115deg,#6e4105,#b87912,#f7d77f,#a96808,#ffe7a1,#b87912,#6e4105)]" />
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
        {err ? (
          <Card className="p-8 text-center"><h1 className="text-[20px] font-bold text-ink">{err.status === 410 ? "This link isn't active" : "We couldn't open this link"}</h1><p className="mx-auto mt-2 max-w-md text-[14px] text-muted">{err.message}</p></Card>
        ) : !v ? (
          <Card className="p-10 text-center text-[14px] text-muted"><span role="status">Loading…</span></Card>
        ) : (
          <>
            {msg && <p role="status" className={`rounded-xl px-4 py-2.5 text-[13.5px] font-semibold ${msg.ok ? "bg-success-soft text-success-ink" : "bg-danger-soft text-danger-ink"}`}>{msg.text}</p>}
            {!active && <Card className="p-4 text-[14px] text-ink">This license isn&rsquo;t active right now. Please contact Monarch Tax Suite{v.contact.email ? ` at ${v.contact.email}` : ""}.</Card>}
            {v.license.lastSeenAt && <Card className="flex items-center gap-3 p-4"><CheckCircle2 className="shrink-0 text-success" /><p className="text-[14px] text-ink">Your calculator is live — last shown on {v.license.lastSeenHost} ({when(v.license.lastSeenAt)}).</p></Card>}

            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink"><Globe size={18} /> 1. Your website</h2>
              <p className="mt-1 text-[13.5px] text-muted">The calculator only shows on the websites you add here (each also covers its www. version). Your license covers up to {v.license.maxDomains}.</p>
              <ul className="mt-3 space-y-2">
                {v.domains.map((d) => <li key={d} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-[14px] text-ink"><span className="font-medium">{d}</span><button type="button" aria-label={`Remove ${d}`} disabled={busy || !active} onClick={() => { if (confirm(`Remove ${d}? The calculator will stop showing there.`)) void act({ action: "removeDomain", domain: d }, "Website removed"); }} className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><Trash2 size={16} /></button></li>)}
                {!v.domains.length && <li className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13.5px] text-muted">No website yet — add yours below.</li>}
              </ul>
              {v.domains.length < v.license.maxDomains && active && (
                <div className="mt-3 flex gap-2"><input aria-label="Your website address" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourfirm.com" className={input} /><Button icon={Plus} disabled={busy || !domain.trim()} onClick={() => void act({ action: "addDomain", domain }, "Website added").then((ok) => ok && setDomain(""))}>Add</Button></div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink"><Copy size={18} /> 2. Put it on your website</h2>
              <label htmlFor="cs-platform" className="mt-3 block text-[13px] font-medium text-ink-2">Your website builder</label>
              <select id="cs-platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className={`${input} mt-1`}>{PLATFORM_GUIDES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14px] text-ink">{guide.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              {guide.note && <p className="mt-2 text-[12.5px] text-muted">{guide.note}</p>}
              <p className="mt-4 text-[13px] font-medium text-ink-2">{guide.uses === "url" ? "Your calculator address" : "Your embed code"}</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-[#0b0b0b] p-3 text-[12px] text-[#f6d37a]">{guide.uses === "url" ? v.installUrl : v.snippet}</pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="primary" icon={Copy} onClick={() => copy(guide.uses === "url" ? v.installUrl : v.snippet, guide.uses === "url" ? "Calculator address" : "Embed code")}>{guide.uses === "url" ? "Copy address" : "Copy embed code"}</Button>
                <Button icon={Copy} onClick={() => copy(guide.uses === "url" ? v.snippet : v.installUrl, guide.uses === "url" ? "Embed code" : "Calculator address")}>{guide.uses === "url" ? "Copy embed code instead" : "Copy address instead"}</Button>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink"><Zap size={18} /> 3. Send leads to your GoHighLevel</h2>
              <p className="mt-1 text-[13.5px] text-muted">When a visitor asks for their estimate, their name, contact details and full estimate go straight to your GoHighLevel. Visitors only see their estimated refund.</p>
              <details className="mt-3 rounded-xl border border-line px-3 py-2 text-[13.5px] text-ink">
                <summary className="cursor-pointer font-medium">How do I get my webhook URL?</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>In GoHighLevel open Automation → Workflows → Create Workflow → Start from scratch.</li>
                  <li>Add the trigger <b>Inbound Webhook</b> and copy the webhook URL it shows.</li>
                  <li>Paste it below and save, then tap <b>Send a test lead</b> so GoHighLevel can see the fields.</li>
                  <li>Back in the workflow, add an action <b>Create/Update Contact</b> and map first name, last name, email and phone. Publish the workflow.</li>
                </ol>
              </details>
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-3 text-[14px] text-ink"><input type="checkbox" className="h-6 w-6" disabled={!active} checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Show the lead form on my calculator</label>
                <div><label htmlFor="cs-biz" className="block text-[13px] font-medium text-ink-2">Business name shown to visitors</label><input id="cs-biz" disabled={!active} value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} className={`${input} mt-1`} /></div>
                <div><label htmlFor="cs-wh" className="block text-[13px] font-medium text-ink-2">GoHighLevel webhook URL {v.leads.webhookSaved && <Badge tone="success">Saved ({v.leads.webhookHost})</Badge>}</label><input id="cs-wh" type="password" autoComplete="off" disabled={!active} value={f.webhookUrl} onChange={(e) => setF({ ...f, webhookUrl: e.target.value })} placeholder={v.leads.webhookSaved ? "Paste a new one only to replace it" : "https://services.leadconnectorhq.com/hooks/…"} className={`${input} mt-1`} /></div>
                {v.leads.lastSuccessAt && <p className="text-[12.5px] text-success-ink">Last lead delivered {when(v.leads.lastSuccessAt)}.</p>}
                {v.leads.lastError && <p className="text-[12.5px] text-danger-ink">{v.leads.lastError}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" disabled={busy || !active} onClick={() => void act({ action: "leads", ...f }, "Saved")}>Save</Button>
                  <Button icon={Send} disabled={busy || !active || !v.leads.webhookSaved} onClick={() => void act({ action: "testLead" }, "Test lead sent — check your GoHighLevel")}>Send a test lead</Button>
                </div>
              </div>
            </Card>
            <p className="text-center text-[12.5px] text-muted">Questions? {[v.contact.email, v.contact.phone].filter(Boolean).join(" · ") || "Reply to your purchase email."} · Keep this link private — it&rsquo;s your key to this page.</p>
          </>
        )}
      </div>
    </main>
  );
}
