"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FilePlus2, Megaphone, MousePointerClick, Send, Settings2, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { Kpi } from "@/components/biz/BizBits";
import { useTeam } from "@/lib/store/team-store";
import { BACKEND, call } from "@/lib/sync/remote";
import { fmtDateTime, relTime } from "@/lib/format";
import { BRANDS, DEFAULT_FILTERS, STATUS_LABEL, type Brand, type Campaign, type CampaignSettings, type Content, type Filters } from "@/lib/campaigns/config";
import { AudienceBuilder, audienceSummary } from "./AudienceBuilder";

export const campaignHref = (brand: Brand, id: string) => `${brand === "monarch" ? "/monarch" : ""}/campaigns/${id}`;
const TONE = { draft: "neutral", scheduled: "info", sending: "warning", sent: "success", cancelled: "neutral" } as const;
type Usage = { sentToday: number; dailyLimit: number; reserve: number; campaignRoom: number };
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

/** Campaigns for one brand (MKB, or Monarch inside the Monarch workspace). */
export function CampaignsCenter({ brand }: { brand: Brand }) {
  const team = useTeam();
  const [tab, setTab] = useState<"campaigns" | "audiences" | "templates" | "settings">("campaigns");
  const [creating, setCreating] = useState(false);
  const [data, setData] = useState<{ campaigns: Campaign[]; usage: Usage } | null>(null);
  const load = useCallback(() => { if (BACKEND) call<{ campaigns: Campaign[]; usage: Usage }>("GET", `/api/campaigns?brand=${brand}`).then(setData).catch(() => setData({ campaigns: [], usage: { sentToday: 0, dailyLimit: 100, reserve: 20, campaignRoom: 80 } })); }, [brand]);
  useEffect(() => { load(); }, [load]);
  if (!BACKEND) return <PageHeader title="Campaigns" subtitle="Campaigns work with the live backend only." />;
  const list = data?.campaigns ?? [];
  const sent = list.filter((c) => c.stats && c.stats.sent > 0);
  const tot = sent.reduce((n, c) => ({ s: n.s + (c.stats?.sent ?? 0), o: n.o + (c.stats?.opened ?? 0), k: n.k + (c.stats?.clicked ?? 0) }), { s: 0, o: 0, k: 0 });
  const canCreate = team.can("campaigns", "create");

  return (
    <>
      <PageHeader title={brand === "monarch" ? "Monarch campaigns" : "Campaigns"} subtitle={`Marketing emails from ${BRANDS[brand].label}. Unsubscribes are honored automatically, and every email carries your unsubscribe link and mailing address.`}
        actions={canCreate && <Button variant="primary" icon={FilePlus2} onClick={() => setCreating(true)}>New campaign</Button>} />
      <div className="mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Campaigns sent" value={list.filter((c) => c.status === "sent").length} sub={`${list.filter((c) => c.status === "draft").length} draft · ${list.filter((c) => c.status === "scheduled" || c.status === "sending").length} scheduled or sending`} icon={Megaphone} />
        <Kpi label="Emails delivered" value={tot.s} icon={Send} />
        <Kpi label="Opened" value={pct(tot.o, tot.s)} sub="Some mail apps hide opens" icon={Users} />
        <Kpi label="Clicked" value={pct(tot.k, tot.s)} icon={MousePointerClick} tone="success" />
      </div>
      {data && <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px] text-ink-2">Today: {data.usage.sentToday} of {data.usage.dailyLimit} emails used (all kinds). Campaigns can send <b>{data.usage.campaignRoom}</b> more today — {data.usage.reserve} are kept for intake links, receipts and other system emails. Larger campaigns continue automatically over the next days.</p>}
      <div role="tablist" aria-label="Campaigns" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {([["campaigns", `Campaigns (${list.length})`], ["audiences", "Audiences"], ["templates", "Templates"], ["settings", "Settings"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] font-medium ${tab === k ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}>{l}</button>)}
      </div>
      {tab === "campaigns" ? <CampaignList brand={brand} list={list} loading={!data} />
        : tab === "audiences" ? <Audiences brand={brand} />
        : tab === "templates" ? <Templates brand={brand} />
        : <><SettingsTab brand={brand} /><div className="mt-5"><TextSettings brand={brand} /></div></>}
      <NewCampaign brand={brand} open={creating} onClose={() => setCreating(false)} list={list} />
    </>
  );
}

function CampaignList({ brand, list, loading }: { brand: Brand; list: Campaign[]; loading: boolean }) {
  if (loading) return <Card className="p-8 text-center text-[13.5px] text-muted">Loading…</Card>;
  if (!list.length) return <Card className="p-8 text-center"><Megaphone className="mx-auto text-faint" size={28} /><p className="mt-2 text-[15px] font-semibold text-ink">No campaigns yet</p><p className="text-[13.5px] text-muted">Start with New campaign — you&rsquo;ll pick who gets it, write it, send yourself a test, then send or schedule.</p></Card>;
  return (
    <Card>
      <ul className="divide-y divide-line">
        {list.map((c) => (
          <li key={c.id}>
            <Link href={campaignHref(brand, c.id)} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-surface-hover sm:px-6">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-ink">{c.name} <span className="ml-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{c.channel === "sms" ? "Text" : "Email"}</span></span>
                <span className="block truncate text-[12.5px] text-muted">{c.channel === "sms" ? c.content.body.slice(0, 60) || "No message yet" : c.content.subject || "No subject yet"} · {c.status === "scheduled" && c.scheduledAt ? `scheduled ${fmtDateTime(c.scheduledAt)}` : c.status === "sent" && c.finishedAt ? `sent ${relTime(c.finishedAt)}` : `edited ${relTime(c.updatedAt)}`}</span>
              </span>
              {c.stats && c.stats.total > 0 && <span className="text-[12.5px] text-muted">{c.stats.sent}/{c.stats.total} sent · {c.channel === "sms" ? `${c.stats.delivered ?? 0} delivered · ${c.stats.replied ?? 0} replied` : `${pct(c.stats.opened, c.stats.sent)} opened · ${pct(c.stats.clicked, c.stats.sent)} clicked`}</span>}
              <Badge tone={TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function NewCampaign({ brand, open, onClose, list }: { brand: Brand; open: boolean; onClose: () => void; list: Campaign[] }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [start, setStart] = useState("blank");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) call<{ templates: { id: string; name: string }[] }>("GET", `/api/campaigns/templates?brand=${brand}`).then((r) => setTemplates(r.templates)).catch(() => {}); }, [open, brand]);
  const create = async () => {
    setBusy(true);
    try {
      const [kind, id] = start.split(":");
      const r = await call<{ campaign: Campaign }>("POST", "/api/campaigns", { brand, name, channel, templateId: kind === "tpl" ? id : undefined, copyOf: kind === "copy" ? id : undefined });
      router.push(campaignHref(brand, r.campaign.id));
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't create", "info"); setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="New campaign" description={`From ${BRANDS[brand].label}. It stays a draft until you send or schedule it.`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || !name.trim()} onClick={create}>{busy ? "Creating…" : "Create draft"}</Button></>}>
      <div className="space-y-3">
        <TextField label="Campaign name (only you see this)" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. January — tax season is open" autoFocus />
        <div role="radiogroup" aria-label="Send as" className="grid grid-cols-2 gap-2">{([["email", "Email", "Branded email with a button"], ["sms", "Text message", "Only to people who opted in to texts"]] as const).map(([k, l, d]) => <button key={k} type="button" role="radio" aria-checked={channel === k} onClick={() => { setChannel(k); setStart("blank"); }} className={`rounded-xl border p-3 text-left ${channel === k ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-hover"}`}><span className="block text-[14px] font-semibold text-ink">{l}</span><span className="block text-[12px] text-muted">{d}</span></button>)}</div>
        <SelectField label="Start from" value={start} onChange={(e) => setStart(e.target.value)} options={[["blank", channel === "sms" ? "A blank text" : "A blank email"], ...(channel === "email" ? templates.map((t) => [`tpl:${t.id}`, `Template: ${t.name}`] as [string, string]) : []), ...list.filter((c) => c.channel === channel).slice(0, 15).map((c) => [`copy:${c.id}`, `Copy of: ${c.name}`] as [string, string])]} />
      </div>
    </Modal>
  );
}

function Audiences({ brand }: { brand: Brand }) {
  const toast = useToast();
  const team = useTeam();
  const [list, setList] = useState<{ id: string; name: string; filters: Filters }[] | null>(null);
  const [edit, setEdit] = useState<{ id?: string; name: string; filters: Filters } | null>(null);
  const load = useCallback(() => call<{ audiences: { id: string; name: string; filters: Filters }[] }>("GET", `/api/campaigns/audiences?brand=${brand}`).then((r) => setList(r.audiences)).catch(() => setList([])), [brand]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!edit) return;
    try { const r = await call<{ audiences: typeof list }>("POST", "/api/campaigns/audiences", { ...edit, brand }); setList(r.audiences); setEdit(null); toast("Audience saved"); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Delete this saved audience? Campaigns already sent aren't affected.")) return;
    try { const r = await call<{ audiences: typeof list }>("DELETE", `/api/campaigns/audiences/${id}`); setList(r.audiences); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "info"); }
  };
  return (
    <Card>
      <CardHeader title="Saved audiences" subtitle="Reusable groups of people — pick one when you write a campaign. The list is worked out fresh each time you send."
        action={team.can("campaigns", "edit") && <Button size="sm" variant="primary" onClick={() => setEdit({ name: "", filters: DEFAULT_FILTERS[brand] })}>New audience</Button>} />
      {!list ? <p className="border-t border-line px-6 py-4 text-[13px] text-muted">Loading…</p> : !list.length ? <p className="border-t border-line px-6 py-4 text-[13.5px] text-muted">No saved audiences yet.</p> : (
        <ul className="divide-y divide-line border-t border-line">
          {list.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-ink">{x.name}</span><span className="block text-[12.5px] text-muted">{audienceSummary(brand, x.filters)}</span></span>
              {team.can("campaigns", "edit") && <Button size="sm" onClick={() => setEdit(x)}>Edit</Button>}
              {team.can("campaigns", "delete") && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void remove(x.id)}>Delete</Button>}
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit audience" : "New audience"} size="lg"
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" disabled={!edit?.name.trim()} onClick={save}>Save audience</Button></>}>
        {edit && <div className="space-y-4"><TextField label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Open tax leads — Louisiana" /><AudienceBuilder brand={brand} filters={edit.filters} onChange={(filters) => setEdit({ ...edit, filters })} /></div>}
      </Modal>
    </Card>
  );
}

function Templates({ brand }: { brand: Brand }) {
  const toast = useToast();
  const team = useTeam();
  const [list, setList] = useState<{ id: string; name: string; content: Content; updatedAt: string }[] | null>(null);
  useEffect(() => { call<{ templates: typeof list }>("GET", `/api/campaigns/templates?brand=${brand}`).then((r) => setList(r.templates)).catch(() => setList([])); }, [brand]);
  const remove = async (id: string) => {
    if (!window.confirm("Delete this template?")) return;
    try { const r = await call<{ templates: typeof list }>("DELETE", `/api/campaigns/templates/${id}`); setList(r.templates); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "info"); }
  };
  return (
    <Card>
      <CardHeader title="Templates" subtitle="Save any campaign's email as a template from its editor (Save as template), then start new campaigns from it." />
      {!list ? <p className="border-t border-line px-6 py-4 text-[13px] text-muted">Loading…</p> : !list.length ? <p className="border-t border-line px-6 py-4 text-[13.5px] text-muted">No templates yet.</p> : (
        <ul className="divide-y divide-line border-t border-line">
          {list.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-ink">{t.name}</span><span className="block truncate text-[12.5px] text-muted">{t.content.subject || "No subject"} · updated {relTime(t.updatedAt)}</span></span>
              {team.can("campaigns", "delete") && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void remove(t.id)}>Delete</Button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SettingsTab({ brand }: { brand: Brand }) {
  const toast = useToast();
  const team = useTeam();
  const [s, setS] = useState<CampaignSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { call<{ settings: CampaignSettings[] }>("GET", "/api/campaigns/settings").then((r) => setS(r.settings.find((x) => x.brand === brand) ?? null)).catch(() => {}); }, [brand]);
  if (!s) return <Card className="p-8 text-center text-[13.5px] text-muted">Loading…</Card>;
  const can = team.can("campaigns", "settings");
  const save = async () => {
    setBusy(true);
    try { const r = await call<{ settings: CampaignSettings[] }>("PUT", `/api/campaigns/settings/${brand}`, s); setS(r.settings.find((x) => x.brand === brand) ?? s); toast("Settings saved"); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  return (
    <Card>
      <CardHeader icon={Settings2} title={`${BRANDS[brand].label} — sender & limits`} subtitle="Used for every campaign from this brand." />
      <fieldset disabled={!can} className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2 sm:px-6">
        <TextField label="From name" value={s.fromName} onChange={(e) => setS({ ...s, fromName: e.target.value })} />
        <TextField label="From address" value={s.fromEmail} onChange={(e) => setS({ ...s, fromEmail: e.target.value })} hint={brand === "monarch" ? "monarchtaxsuite.com must be verified in Resend first" : undefined} />
        <TextField label="Replies go to" value={s.replyTo} onChange={(e) => setS({ ...s, replyTo: e.target.value })} placeholder="e.g. info@mkbfinancialgroup.com" />
        <div className="sm:col-span-2"><TextArea label="Mailing address (required — shown at the bottom of every marketing email)" value={s.mailingAddress} onChange={(e) => setS({ ...s, mailingAddress: e.target.value })} rows={2} placeholder="Street or P.O. box, City, State ZIP" /></div>
        <TextField label="Daily email limit (your Resend plan)" type="number" value={String(s.dailyLimit)} onChange={(e) => setS({ ...s, dailyLimit: Number(e.target.value) })} hint="Free plan: 100" />
        <TextField label="Keep free each day for system emails" type="number" value={String(s.reserve)} onChange={(e) => setS({ ...s, reserve: Number(e.target.value) })} hint="Intake links, receipts…" />
        <p className="text-[12.5px] text-muted sm:col-span-2">The daily limit is shared by both brands (one email account). On the Pro plan, raise it to your plan&rsquo;s limit.</p>
        {can && <div className="sm:col-span-2"><Button variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</Button></div>}
      </fieldset>
    </Card>
  );
}


/** Twilio account (shared) and the text number for each brand. */
function TextSettings({ brand }: { brand: Brand }) {
  const toast = useToast();
  const team = useTeam();
  type S = { accountSid: string; tokenSaved: { last4: string; at: string } | null; numbers: { mkb: string; monarch: string }; webhooks: { inbound: string; status: string }; simulated: boolean };
  const [s, setS] = useState<S | null>(null);
  const [token, setToken] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { call<S>("GET", "/api/sms/settings").then(setS).catch(() => {}); }, []);
  if (!s) return null;
  const can = team.can("campaigns", "settings");
  const save = async () => {
    setBusy(true);
    try { const r = await call<S>("PUT", "/api/sms/settings", { accountSid: s.accountSid, authToken: token || undefined, mkbNumber: s.numbers.mkb, monarchNumber: s.numbers.monarch }); setS(r); setToken(""); toast("Text messaging settings saved"); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "info"); }
    setBusy(false);
  };
  const test = async () => {
    try { await call("POST", "/api/sms/test", { brand, to: testTo }); toast(s.simulated && !s.tokenSaved ? "Test recorded (test mode — not really sent)" : "Test text sent"); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't send", "info"); }
  };
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast("Copied"), () => toast("Couldn't copy", "info"));
  return (
    <Card>
      <CardHeader title="Text messaging (Twilio)" subtitle="One Twilio account for both brands, with a separate number for MKB and for Monarch. Your Auth Token is stored encrypted and never shown again." />
      <fieldset disabled={!can} className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2 sm:px-6">
        <TextField label="Account SID" value={s.accountSid} onChange={(e) => setS({ ...s, accountSid: e.target.value.trim() })} placeholder="AC…" />
        <TextField label="Auth Token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={s.tokenSaved ? `Saved (ends in ${s.tokenSaved.last4}) — type to replace` : "Paste from your Twilio console"} />
        <TextField label="MKB Financial Group text number" type="tel" value={s.numbers.mkb} onChange={(e) => setS({ ...s, numbers: { ...s.numbers, mkb: e.target.value } })} placeholder="(318) 555-0100" />
        <TextField label="Monarch Tax Suite text number" type="tel" value={s.numbers.monarch} onChange={(e) => setS({ ...s, numbers: { ...s.numbers, monarch: e.target.value } })} placeholder="(318) 555-0200" />
        <div className="space-y-2 rounded-xl bg-surface-2 p-3.5 text-[13px] text-ink-2 sm:col-span-2">
          <p className="font-semibold text-ink">In Twilio, for each of the two numbers (Phone Numbers → Manage → your number → Messaging):</p>
          <p>“A message comes in” → Webhook, HTTP POST: <code className="break-all rounded bg-surface px-1">{s.webhooks.inbound}</code> <button type="button" className="font-semibold text-accent" onClick={() => copy(s.webhooks.inbound)}>Copy</button></p>
          <p className="text-muted">Delivery updates come back automatically to {s.webhooks.status}.</p>
        </div>
        {can && <div className="flex flex-wrap items-end gap-2 sm:col-span-2"><Button variant="primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save text settings"}</Button><span className="mx-2 h-6 w-px bg-line" /><div className="w-48"><TextField label="Send a test to" type="tel" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Your mobile" /></div><Button onClick={() => void test()}>Send test text</Button></div>}
      </fieldset>
    </Card>
  );
}
