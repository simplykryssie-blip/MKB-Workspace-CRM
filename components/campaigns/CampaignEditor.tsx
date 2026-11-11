"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Copy, FlaskConical, Save, Send, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useTeam } from "@/lib/store/team-store";
import { call } from "@/lib/sync/remote";
import { fmtDateTime } from "@/lib/format";
import { BRANDS, FILL_INS, STATUS_LABEL, type Brand, type Campaign, type CampaignSettings, type Content, type Filters } from "@/lib/campaigns/config";
import { AudienceBuilder } from "./AudienceBuilder";
import { campaignHref } from "./CampaignsCenter";

type Recipient = { id: string; address: string; name: string; contact_type: string; contact_id: string; status: string; error: string | null; sent_at: string | null; opened_at: string | null; clicked_at: string | null; unsubscribed_at: string | null };
type Loaded = { campaign: Campaign; recipients: Recipient[]; settings: CampaignSettings; usage: { sentToday: number; dailyLimit: number; reserve: number; campaignRoom: number } };
const TONE = { draft: "neutral", scheduled: "info", sending: "warning", sent: "success", cancelled: "neutral" } as const;

export function CampaignEditor({ id, brand }: { id: string; brand: Brand }) {
  const [d, setD] = useState<Loaded | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => call<Loaded>("GET", `/api/campaigns/${id}`).then(setD).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load")), [id]);
  useEffect(() => { void load(); }, [load]);
  const base = brand === "monarch" ? "/monarch/campaigns" : "/campaigns";
  if (err) return <PageHeader title="Campaign" subtitle={err} crumbs={[{ label: "Campaigns", href: base }, { label: "Not found" }]} />;
  if (!d) return <p className="p-8 text-center text-[13.5px] text-muted">Loading…</p>;
  return d.campaign.status === "draft" ? <Draft d={d} base={base} reload={load} setD={setD} /> : <Results d={d} base={base} reload={load} />;
}

function Preview({ brand, content }: { brand: Brand; content: Content }) {
  const [html, setHtml] = useState("");
  const key = JSON.stringify(content);
  useEffect(() => {
    const t = setTimeout(() => { call<{ html: string }>("POST", "/api/campaigns/preview", { brand, content: JSON.parse(key) }).then((r) => setHtml(r.html)).catch(() => {}); }, 400);
    return () => clearTimeout(t);
  }, [brand, key]);
  return <iframe title="Email preview" srcDoc={html.replace("<head>", '<head><base target="_blank">')} className="h-[720px] w-full rounded-xl border border-line bg-[#eceae4]" />;
}

function Draft({ d, base, reload, setD }: { d: Loaded; base: string; reload: () => Promise<void>; setD: (d: Loaded) => void }) {
  const router = useRouter();
  const toast = useToast();
  const team = useTeam();
  const c = d.campaign;
  const [name, setName] = useState(c.name);
  const [content, setContent] = useState<Content>(c.content);
  const [filters, setFilters] = useState<Filters>(c.filters);
  const [audiences, setAudiences] = useState<{ id: string; name: string; filters: Filters }[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [sending, setSending] = useState<null | "now" | "later">(null);
  const [when, setWhen] = useState("");
  const [tplName, setTplName] = useState<string | null>(null);
  const rev = useRef(c.rev);
  const canEdit = team.can("campaigns", "edit");
  const canSend = team.can("campaigns", "approve");
  useEffect(() => { call<{ audiences: typeof audiences }>("GET", `/api/campaigns/audiences?brand=${c.brand}`).then((r) => setAudiences(r.audiences)).catch(() => {}); }, [c.brand]);
  const set = (patch: Partial<Content>) => { setContent((x) => ({ ...x, ...patch })); setDirty(true); };

  const save = async (quiet = false) => {
    try {
      const r = await call<Loaded>("PUT", `/api/campaigns/${c.id}`, { name, content, filters, rev: rev.current });
      rev.current = r.campaign.rev; setDirty(false);
      if (!quiet) toast("Draft saved");
      return true;
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); if (e instanceof Error && /changed somewhere else/.test(e.message)) void reload(); return false; }
  };
  const test = async () => {
    setBusy(true);
    if (await save(true)) {
      try { const r = await call<{ sentTo: string }>("POST", `/api/campaigns/${c.id}/test`, { to: testTo }); toast(`Test sent to ${r.sentTo}`); setTesting(false); }
      catch (e) { toast(e instanceof Error ? e.message : "Couldn't send the test", "info"); }
    }
    setBusy(false);
  };
  const send = async () => {
    setBusy(true);
    if (await save(true)) {
      try {
        const r = await call<Loaded>("POST", `/api/campaigns/${c.id}/send`, sending === "later" ? { at: new Date(when).toISOString() } : {});
        toast(sending === "later" ? `Scheduled for ${fmtDateTime(r.campaign.scheduledAt ?? when)}` : `Sending — ${r.campaign.stats?.sent ?? 0} sent so far`);
        setSending(null); setD(r);
      } catch (e) { toast(e instanceof Error ? e.message : "Couldn't send", "info"); }
    }
    setBusy(false);
  };
  const saveTemplate = async () => {
    try { await call("POST", "/api/campaigns/templates", { brand: c.brand, name: tplName, content }); toast("Saved as a template"); setTplName(null); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
  };
  const remove = async () => {
    if (!window.confirm("Delete this draft?")) return;
    try { await call("DELETE", `/api/campaigns/${c.id}`); router.push(base); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "info"); }
  };

  return (
    <>
      <PageHeader title={name || "Untitled campaign"} subtitle={`Draft · ${BRANDS[c.brand].label} · from ${d.settings.fromName} <${d.settings.fromEmail}>`} crumbs={[{ label: "Campaigns", href: base }, { label: name || "Draft" }]}
        actions={<div className="flex flex-wrap gap-2">
          {canEdit && <Button icon={Save} disabled={!dirty} onClick={() => void save()}>{dirty ? "Save draft" : "Saved"}</Button>}
          {canEdit && <Button icon={FlaskConical} onClick={() => { setTestTo(""); setTesting(true); }}>Send test</Button>}
          {canSend && <Button icon={CalendarClock} onClick={() => setSending("later")}>Schedule</Button>}
          {canSend && <Button variant="primary" icon={Send} onClick={() => setSending("now")}>Send now</Button>}
        </div>} />
      {!d.settings.mailingAddress && <p role="alert" className="mb-4 rounded-xl bg-warning-soft/60 px-4 py-2.5 text-[13px] text-warning-ink">Add your mailing address in Campaigns → Settings before sending — the law requires it in every marketing email.</p>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="1. Who gets it" subtitle="Unsubscribed people and duplicates are always left out." />
            <div className="space-y-3 border-t border-line px-5 py-4 sm:px-6">
              {audiences.length > 0 && <SelectField label="Use a saved audience" value="" onChange={(e) => { const a = audiences.find((x) => x.id === e.target.value); if (a) { setFilters(a.filters); setDirty(true); } }} options={[["", "Choose…"], ...audiences.map((a) => [a.id, a.name] as [string, string])]} />}
              <AudienceBuilder brand={c.brand} filters={filters} onChange={(f) => { setFilters(f); setDirty(true); }} disabled={!canEdit} />
            </div>
          </Card>
          <Card>
            <CardHeader title="2. The email" subtitle={`Fill-ins: ${FILL_INS.map((x) => `{${x}}`).join(" ")}. Blank line = new paragraph · "- " = bullet · **bold**`} />
            <fieldset disabled={!canEdit} className="min-w-0 space-y-3 border-t border-line px-5 py-4 sm:px-6">
              <TextField label="Campaign name (only you see this)" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
              <TextField label="Subject line" required value={content.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="e.g. {first name}, tax season is open" />
              <TextField label="Preview text (shown after the subject in the inbox)" value={content.preheader ?? ""} onChange={(e) => set({ preheader: e.target.value })} />
              <TextField label="Headline" value={content.heading ?? ""} onChange={(e) => set({ heading: e.target.value })} />
              <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Message <span className="text-danger">*</span></span>
                <textarea value={content.body} onChange={(e) => set({ body: e.target.value })} rows={12} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15" placeholder={"Hi {first name},\n\nWrite your message here.\n\n- A bullet point\n- Another one"} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Button text" value={content.buttonLabel ?? ""} onChange={(e) => set({ buttonLabel: e.target.value })} placeholder="e.g. Book a consultation" />
                <TextField label="Button link (https://…)" value={content.buttonUrl ?? ""} onChange={(e) => set({ buttonUrl: e.target.value })} placeholder="https://www.mkbfinancialgroup.com/book-consultation" />
              </div>
              <TextField label="Picture at the top (optional) — paste a link from Website → Media library" value={content.image ?? ""} onChange={(e) => set({ image: e.target.value })} placeholder="https://www.mkbfinancialgroup.com/site/media/…" />
            </fieldset>
          </Card>
          <div className="flex flex-wrap gap-2">
            {canEdit && <Button icon={Copy} onClick={() => setTplName(name)}>Save as template</Button>}
            {team.can("campaigns", "delete") && <Button variant="ghost" icon={Trash2} onClick={() => void remove()}>Delete draft</Button>}
          </div>
        </div>
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card><CardHeader title="Preview" subtitle={`Subject: ${content.subject || "—"} · shown for a sample person`} /><div className="border-t border-line p-3"><Preview brand={c.brand} content={content} /></div></Card>
        </div>
      </div>

      <Modal open={testing} onClose={() => setTesting(false)} title="Send a test" description="A copy marked [Test] — to your email unless you enter another address. Tests don't count as sends."
        footer={<><Button onClick={() => setTesting(false)}>Cancel</Button><Button variant="primary" icon={FlaskConical} disabled={busy} onClick={() => void test()}>{busy ? "Sending…" : "Send test"}</Button></>}>
        <TextField label="Send the test to (leave blank for you)" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
      </Modal>
      <Modal open={!!sending} onClose={() => setSending(null)} title={sending === "later" ? "Schedule this campaign" : "Send this campaign now?"}
        description="Who gets it is worked out when sending starts, so new leads that match are included and anyone who unsubscribed is left out."
        footer={<><Button onClick={() => setSending(null)}>Cancel</Button><Button variant="primary" icon={sending === "later" ? CalendarClock : Send} disabled={busy || (sending === "later" && !when)} onClick={() => void send()}>{busy ? "Working…" : sending === "later" ? "Schedule" : "Send now"}</Button></>}>
        <div className="space-y-3 text-[13.5px] text-ink-2">
          {sending === "later" && <TextField label="Send on" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}
          <p>Today campaigns can send <b>{d.usage.campaignRoom}</b> more emails under your daily limit of {d.usage.dailyLimit}. If the list is bigger, the rest go out automatically over the next days.</p>
          <p className="text-muted">Once sending starts the email can&rsquo;t be edited. You can stop what hasn&rsquo;t gone out yet.</p>
        </div>
      </Modal>
      <Modal open={tplName !== null} onClose={() => setTplName(null)} title="Save as template" footer={<><Button onClick={() => setTplName(null)}>Cancel</Button><Button variant="primary" disabled={!tplName?.trim()} onClick={() => void saveTemplate()}>Save template</Button></>}>
        <TextField label="Template name" value={tplName ?? ""} onChange={(e) => setTplName(e.target.value)} />
      </Modal>
    </>
  );
}

function Results({ d, base, reload }: { d: Loaded; base: string; reload: () => Promise<void> }) {
  const router = useRouter();
  const toast = useToast();
  const team = useTeam();
  const c = d.campaign;
  const s = c.stats!;
  const [filter, setFilter] = useState("all");
  useEffect(() => { if (c.status === "sending" || c.status === "scheduled") { const t = setInterval(() => void reload(), 20_000); return () => clearInterval(t); } }, [c.status, reload]);
  const stop = async () => {
    if (!window.confirm(c.status === "scheduled" ? "Cancel the schedule? It goes back to a draft." : "Stop sending? Emails already sent can't be recalled; the rest won't go out.")) return;
    try { await call("POST", `/api/campaigns/${c.id}/cancel`); await reload(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't stop", "info"); }
  };
  const copy = async () => {
    try { const r = await call<{ campaign: Campaign }>("POST", "/api/campaigns", { brand: c.brand, name: `${c.name} (copy)`, copyOf: c.id }); router.push(campaignHref(c.brand, r.campaign.id)); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't copy", "info"); }
  };
  const pct = (n: number) => (s.sent ? `${Math.round((n / s.sent) * 100)}%` : "—");
  const rows = d.recipients.filter((r) => filter === "all" || (filter === "opened" ? r.opened_at : filter === "clicked" ? r.clicked_at : filter === "unsubscribed" ? r.unsubscribed_at : r.status === filter));
  const href = (r: Recipient) => (r.contact_type === "lead" ? `/leads/${r.contact_id}` : r.contact_type === "client" ? `/clients/${r.contact_id}` : r.contact_type === "office" ? `/monarch/offices/${r.contact_id}` : null);
  return (
    <>
      <PageHeader title={c.name} subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>{c.status === "scheduled" && c.scheduledAt ? `Goes out ${fmtDateTime(c.scheduledAt)}` : c.finishedAt ? `Finished ${fmtDateTime(c.finishedAt)}` : c.startedAt ? `Started ${fmtDateTime(c.startedAt)}` : ""} · Subject: {c.content.subject}</span>}
        crumbs={[{ label: "Campaigns", href: base }, { label: c.name }]}
        actions={<div className="flex flex-wrap gap-2">
          {(c.status === "scheduled" || c.status === "sending") && team.can("campaigns", "approve") && <Button icon={XCircle} onClick={() => void stop()}>{c.status === "scheduled" ? "Cancel schedule" : "Stop sending"}</Button>}
          {team.can("campaigns", "create") && <Button icon={Copy} onClick={() => void copy()}>Copy to new campaign</Button>}
        </div>} />
      {c.status === "sending" && s.queued > 0 && <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px] text-ink-2">{s.queued} still waiting — they go out automatically as your daily email limit allows (checked every 15 minutes).</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {([["Recipients", s.total], ["Sent", s.sent], ["Opened", `${s.opened} · ${pct(s.opened)}`], ["Clicked", `${s.clicked} · ${pct(s.clicked)}`], ["Unsubscribed", s.unsubscribed], ["Failed / skipped", s.failed + s.skipped]] as const).map(([l, v]) => <Card key={l} className="p-4"><p className="text-[12px] text-muted">{l}</p><p className="mt-1 text-[20px] font-bold text-ink">{v}</p></Card>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Recipients" action={<select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-xl border border-line bg-surface px-2 text-[13px]">{[["all", "Everyone"], ["sent", "Sent"], ["queued", "Waiting"], ["opened", "Opened"], ["clicked", "Clicked"], ["unsubscribed", "Unsubscribed"], ["failed", "Failed"], ["skipped", "Skipped"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>} />
          {c.status === "scheduled" ? <p className="border-t border-line px-6 py-4 text-[13.5px] text-muted">The list is made when sending starts.</p> : (
            <div className="max-h-[640px] overflow-auto border-t border-line">
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 bg-surface text-[11.5px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Opened</th><th className="px-4 py-2">Clicked</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => { const h = href(r); return (
                    <tr key={r.id}>
                      <td className="px-4 py-2">{h ? <a href={h} className="font-medium text-ink hover:text-accent">{r.name || r.address}</a> : <span className="font-medium text-ink">{r.name || r.address}</span>}<span className="block text-[12px] text-muted">{r.address}</span></td>
                      <td className="px-4 py-2">{r.unsubscribed_at ? <Badge tone="warning">Unsubscribed</Badge> : r.status === "sent" ? <Badge tone="success">Sent</Badge> : r.status === "queued" ? <Badge tone="info">Waiting</Badge> : <span title={r.error ?? ""}><Badge tone="danger">{r.status === "failed" ? "Failed" : "Skipped"}</Badge></span>}</td>
                      <td className="px-4 py-2 text-muted">{r.opened_at ? fmtDateTime(r.opened_at) : "—"}</td>
                      <td className="px-4 py-2 text-muted">{r.clicked_at ? fmtDateTime(r.clicked_at) : "—"}</td>
                    </tr>); })}
                  {!rows.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">Nobody here.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card><CardHeader title="The email" subtitle="As sent (sample person)" /><div className="border-t border-line p-3"><Preview brand={c.brand} content={c.content} /></div></Card>
      </div>
      <p className="mt-4 text-[12.5px] text-muted">Opens are estimates: some mail apps load pictures automatically (counting an open) and others block them. Clicks are reliable.</p>
    </>
  );
}
